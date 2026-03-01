module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;

        // Optionen aus Node-Konfiguration
        node.mustInclude = config.mustInclude || "Ein";
        node.direction = config.direction || "Ein→Aus";
        node.debug = config.debug || false;

        node.on('input', function(msg) {
            let newState = msg.data?.event?.new_state?.state || msg.payload || "";
            let lastState = node.context().flow.get("lastState") || "";

            let trigger = false;

            if ((node.direction === "Ein→Aus" || node.direction === "Beide") &&
                lastState.includes(node.mustInclude) && newState.includes("Aus")) {
                trigger = true;
            }
            if ((node.direction === "Aus→Ein" || node.direction === "Beide") &&
                lastState.includes("Aus") && newState.includes(node.mustInclude)) {
                trigger = true;
            }

            if(trigger) {
                node.context().flow.set("lastState", newState);
                if(node.debug) node.warn(`Trigger ausgelöst: ${lastState} → ${newState}`);
                node.send(msg);
                return;
            }

            node.context().flow.set("lastState", newState);
        });
    }
    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}