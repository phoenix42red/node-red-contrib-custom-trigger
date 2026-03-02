module.exports = function(RED) {

    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // ==========================
        // Konfiguration
        // ==========================
        node.name = config.name || "";
        node.msgPath = config.msgPath || "";
        node.mustInclude = config.mustInclude || "";
        node.oldMustContain = config.oldMustContain || "";
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.direction = config.direction || "Beide"; // "Ein→Aus", "Aus→Ein", "Beide"
        node.debug = config.debug || false;
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = Number(config.cooldown) || 0;

        const flowKey = `lastMsg_${node.id}`;
        let lastTriggeredTime = 0;

        // ==========================
        // Eingehende Nachricht
        // ==========================
        node.on('input', function(msg) {

            // --------------------------
            // Wert anhand msgPath holen
            // --------------------------
            let newValue;

            if (node.msgPath) {
                try {
                    newValue = node.msgPath
                        .split('.')
                        .reduce((obj, key) => obj && obj[key], msg);
                } catch (e) {
                    newValue = undefined;
                }
            } else {
                newValue = msg;
            }

            // --------------------------
            // Saubere String-Konvertierung
            // --------------------------
            if (typeof newValue === "object") {
                newValue = JSON.stringify(newValue);
            } else if (newValue === undefined || newValue === null) {
                newValue = "";
            } else {
                newValue = String(newValue);
            }

            // Letzten gespeicherten Wert holen
            let lastValue = node.context().flow.get(flowKey);
            if (lastValue === undefined || lastValue === null) {
                lastValue = "";
            }

            // --------------------------
            // Erste Nachricht Trigger
            // --------------------------
            if (!lastValue && node.triggerOnFirstMessage) {
                node.context().flow.set(flowKey, newValue);
                node.status({ fill: "blue", shape: "dot", text: "Erste Nachricht" });
                if (node.debug) node.warn(`Trigger (erste Nachricht): ${newValue}`);
                return msg;
            }

            // --------------------------
            // Cooldown prüfen
            // --------------------------
            const now = Date.now();
            if (node.cooldown > 0 && (now - lastTriggeredTime < node.cooldown)) {
                return null;
            }

            // --------------------------
            // Prüfen ob sich Wert geändert hat
            // --------------------------
            if (lastValue === newValue) {
                node.status({ fill: "grey", shape: "ring", text: "Keine Änderung" });
                return null;
            }

            let trigger = false;

            // ==========================
            // Textfilter prüfen
            // ==========================
            let match = true;

            if (node.mustInclude) {

                if (node.useRegex && node.pattern) {
                    try {
                        const regex = new RegExp(node.pattern, "i");
                        match = regex.test(newValue);
                    } catch (e) {
                        node.error("Ungültiger Regex-Ausdruck");
                        return null;
                    }
                } else {
                    match = newValue.includes(node.mustInclude);
                }

                // Optional: alter Wert muss enthalten
                if (node.oldMustContain) {
                    if (!lastValue.includes(node.oldMustContain)) {
                        match = false;
                    }
                }

                if (!match) {
                    node.context().flow.set(flowKey, newValue);
                    node.status({ fill: "yellow", shape: "ring", text: "Filter nicht erfüllt" });
                    return null;
                }
            }

            // ==========================
            // Richtungsprüfung
            // ==========================
            const wasEin = lastValue.includes("Ein");
            const wasAus = lastValue.includes("Aus");
            const isEin  = newValue.includes("Ein");
            const isAus  = newValue.includes("Aus");

            if (node.direction === "Beide") {
                trigger = true;
            }
            else if (node.direction === "Ein→Aus" && wasEin && isAus) {
                trigger = true;
            }
            else if (node.direction === "Aus→Ein" && wasAus && isEin) {
                trigger = true;
            }

            // ==========================
            // Trigger auslösen
            // ==========================
            if (trigger) {

                node.context().flow.set(flowKey, newValue);
                lastTriggeredTime = now;

                node.status({
                    fill: "green",
                    shape: "dot",
                    text: `${lastValue} → ${newValue}`
                });

                if (node.debug) {
                    node.warn(`Trigger ausgelöst: ${lastValue} → ${newValue}`);
                }

                return msg;
            }

            // Änderung aber keine passende Richtung
            node.context().flow.set(flowKey, newValue);
            node.status({ fill: "grey", shape: "ring", text: "Richtung nicht passend" });

            return null;
        });
    }

    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}
