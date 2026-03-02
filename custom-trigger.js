module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        node.fieldPath = config.fieldPath || "payload";
        node.direction = config.direction || "Beide";
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = Number(config.cooldown) || 0;
        node.debug = config.debug || false;

        let lastValue = null;
        let lastTriggerTime = 0;

        function getByPath(obj, path) {
            return path.split(".").reduce((o, p) => o ? o[p] : undefined, obj);
        }

        function normalize(val) {
            if (val === undefined || val === null) return "";
            return String(val).toLowerCase();
        }

        node.on('input', function(msg) {

            const rawValue = getByPath(msg, node.fieldPath);
            const newValue = normalize(rawValue);

            if (newValue === "") return;

            if (lastValue === null) {
                lastValue = newValue;
                if (!node.triggerOnFirstMessage) return;
            }

            if (newValue === lastValue) return;

            let trigger = false;

            const wasTrue  = ["true","1","ein","on"].includes(lastValue);
            const wasFalse = ["false","0","aus","off"].includes(lastValue);

            const isTrue   = ["true","1","ein","on"].includes(newValue);
            const isFalse  = ["false","0","aus","off"].includes(newValue);

            if (node.direction === "Beide") {
                trigger = true;
            }
            else if (node.direction === "Aus→Ein" && wasFalse && isTrue) {
                trigger = true;
            }
            else if (node.direction === "Ein→Aus" && wasTrue && isFalse) {
                trigger = true;
            }

            if (!trigger) {
                lastValue = newValue;
                return;
            }

            const now = Date.now();
            if (node.cooldown > 0 && now - lastTriggerTime < node.cooldown * 1000) {
                return;
            }

            lastTriggerTime = now;

            if (node.debug) {
                node.warn(`Trigger: ${lastValue} → ${newValue}`);
            }

            node.status({
                fill: "green",
                shape: "dot",
                text: `${lastValue} → ${newValue}`
            });

            lastValue = newValue;
            node.send(msg);
        });
    }

    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
};
