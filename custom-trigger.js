module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        node.sensors = config.sensors || [];
        node.previousMustInclude = config.previousMustInclude || "";
        node.mustInclude = config.mustInclude || "";
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.direction = config.direction || "Beide";
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

            let matchNew = node.mustInclude ? (node.useRegex ? new RegExp(node.pattern,"i").test(newState) : newState.includes(node.mustInclude)) : true;
            let matchOld = node.previousMustInclude ? lastState.includes(node.previousMustInclude) : true;

            let trigger = false;
            if(matchOld && matchNew){
                if(node.direction === "Beide" || node.direction === "Vorher→Nachher") trigger = true;
            }

            if(trigger){
                node.context().flow.set(`lastState_${sensorId}`, newState);
                node.lastTriggered[sensorId] = now;
                if(node.debug) node.warn(`Trigger ausgelöst: ${lastState} → ${newState} (Sensor: ${sensorId})`);
                node.send(msg);
            } else {
                node.context().flow.set(`lastState_${sensorId}`, newState);
            }
        });
    }
    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}