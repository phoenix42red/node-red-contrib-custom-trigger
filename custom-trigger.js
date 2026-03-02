module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;
		
       
		// Einstellungen
        node.name = config.name;
        node.sensors = config.sensors
            ? config.sensors.split(",").map(s => s.trim())
            : [];

        node.beforeText = config.beforeText || "";
        node.afterText = config.afterText || "";
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.triggerOnFirstMessage =
            config.triggerOnFirstMessage || true;
        node.cooldown = Number(config.cooldown) || 0;
        node.debug = config.debug || false;

        // interne Daten
        node.lastTriggered = {};
        node.triggerCount = 0;

        // Startstatus
        node.status({
            fill: "grey",
            shape: "ring",
            text: "bereit"
        });
        node.on('input', function(msg) {
            node.status({
                fill: "blue",
                shape: "ring",
                text: "warte"
            });
            const sensorId = msg.topic || "default";
            if (node.sensors.length) {
                if (!node.sensors.includes(sensorId)) {
                    return;
                }
            }
            let newState =
                msg.data?.event?.new_state?.state
                || msg.payload
                || "";
            let lastState =
                node.context().flow.get(
                    `lastState_${sensorId}`
                ) || "";
            if (newState === "") {
                node.status({
                    fill: "red",
                    shape: "dot",
                    text: "kein State"
                });
                return;
            }
            if (!lastState && node.triggerOnFirstMessage) {
                node.context().flow.set(
                    `lastState_${sensorId}`,
                    newState
                );
                node.status({
                    fill: "green",
                    shape: "dot",
                    text: "erste Nachricht"
                });
                node.send(msg);
                return;
            }
            let now = Date.now();
            if (
                node.lastTriggered[sensorId] &&
                (now - node.lastTriggered[sensorId]
                    < node.cooldown)
            ) {
                let rest = Math.ceil(

                    (node.cooldown -
                    (now - node.lastTriggered[sensorId]))
                    / 1000
                );
                node.status({
                    fill: "yellow",
                    shape: "ring",
                    text: `Cooldown ${rest}s`
                });
                return;
            }
            let beforeMatch = true;
            let afterMatch = true;
            if (node.useRegex && node.pattern) {
                let regex =
                    new RegExp(node.pattern, "i");
                beforeMatch =
                    regex.test(lastState);
                afterMatch =
                    regex.test(newState);
            }
            else {
                if (node.beforeText)
                    beforeMatch =
                        lastState.includes(
                            node.beforeText
                        );
                if (node.afterText)
                    afterMatch =
                        newState.includes(
                            node.afterText
                        );
            }
            let trigger =
                beforeMatch &&
                afterMatch;
            if (trigger) {
                node.triggerCount++;
                node.context().flow.set(
                    `lastState_${sensorId}`,
                    newState
                );
                node.lastTriggered[sensorId] = now;
                node.status({
                    fill: "green",
                    shape: "dot",
                    text:
                        `${lastState} → ${newState} (#${node.triggerCount})`
                });
                if (node.debug)
                    node.warn(
                        `Trigger: ${lastState} → ${newState}`
                    );
                node.send(msg);
                return;
            }
            node.context().flow.set(
                `lastState_${sensorId}`,
                newState
            );
            node.status({
                fill: "blue",
                shape: "ring",
                text: "kein Trigger"
            });
        });
    }
    RED.nodes.registerType(
        "custom-trigger",
        CustomTriggerNode
    );
};