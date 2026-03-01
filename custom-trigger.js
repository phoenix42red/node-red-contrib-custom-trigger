module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.sensors = config.sensors || [];
        node.mustInclude = config.mustInclude || "Ein";
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.direction = config.direction || "Ein→Aus";
        node.debug = config.debug || false;
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = config.cooldown || 0;

        node.lastTriggered = {};

        node.on('input', function(msg) {
            const sensorId = msg.topic || "default";
            if(node.sensors.length && !node.sensors.includes(sensorId)) return null;

            let newState = msg.data?.event?.new_state?.state || msg.payload || "";
            let lastState = node.context().flow.get(`lastState_${sensorId}`) || "";

            if(!lastState && node.triggerOnFirstMessage){
                node.context().flow.set(`lastState_${sensorId}`, newState);
                if(node.debug) node.warn(`Trigger (erste Nachricht) Sensor ${sensorId}: ${newState}`);
                return msg;
            }

            let now = Date.now();
            if(node.lastTriggered[sensorId] && (now - node.lastTriggered[sensorId] < node.cooldown)) return null;

            let match = false;
            if(node.useRegex && node.pattern){
                const regex = new RegExp(node.pattern, "i");
                match = regex.test(newState);
            } else {
                match = newState.includes(node.mustInclude);
            }

            if(!match){
                node.context().flow.set(`lastState_${sensorId}`, newState);
                return null;
            }

            let trigger = false;
            if((node.direction === "Ein→Aus" || node.direction === "Beide") &&
               lastState.includes(node.mustInclude) && newState.includes("Aus")) trigger = true;

            if((node.direction === "Aus→Ein" || node.direction === "Beide") &&
               lastState.includes("Aus") && newState.includes(node.mustInclude)) trigger = true;

            if(trigger){
                node.context().flow.set(`lastState_${sensorId}`, newState);
                node.lastTriggered[sensorId] = now;
                if(node.debug) node.warn(`Trigger ausgelöst: ${lastState} → ${newState} (Sensor: ${sensorId})`);
                node.send(msg);
                return;
            }

            node.context().flow.set(`lastState_${sensorId}`, newState);
        });
    }
    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}