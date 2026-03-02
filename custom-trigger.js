module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // --------------------------
        // Node-Konfiguration
        // --------------------------
        node.name = config.name || "";
        node.msgPath = config.msgPath || "";           // z.B. payload, data.attributes.tomorrow_valid
        node.mustInclude = config.mustInclude || "";   // Optional: Neuer Wert muss enthalten
        node.oldMustContain = config.oldMustContain || ""; // Optional: Alter Wert muss enthalten
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.debug = config.debug || false;
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = config.cooldown || 0;

        const flowKey = `lastValue_${node.id}`;
        node.lastTriggered = {}; // Für Cooldown

        // --------------------------
        // Eingehende Nachrichten verarbeiten
        // --------------------------
        node.on('input', function(msg) {
            // 1️⃣ Wert aus msg anhand msgPath holen
            let newValue;
            if(node.msgPath){
                try {
                    newValue = node.msgPath.split('.').reduce((obj, key) => obj && obj[key], msg);
                } catch(e){
                    newValue = undefined;
                }
            } else {
                newValue = msg; // gesamte msg, falls kein Pfad
            }

            // Als String behandeln
            if (typeof newValue === "object") newValue = JSON.stringify(newValue);
            else if(newValue === undefined || newValue === null) newValue = "";
            else newValue = String(newValue);

            // 2️⃣ Letzter Wert
            let lastValue = node.context().flow.get(flowKey) || "";

            // 3️⃣ Trigger bei erster Nachricht
            if(!lastValue && node.triggerOnFirstMessage){
                node.context().flow.set(flowKey, newValue);
                if(node.debug) node.warn(`Trigger (erste Nachricht) ausgelöst: ${newValue}`);
                return node.send(msg);
            }

            // 4️⃣ Cooldown prüfen
            let now = Date.now();
            if(node.lastTriggered[node.id] && (now - node.lastTriggered[node.id] < node.cooldown)) return null;

            // 5️⃣ Prüfen, ob Wert geändert
            if(lastValue !== newValue){
                let trigger = true;

                // 5a️⃣ Neuer Wert muss Text enthalten
                if(node.mustInclude){
                    if(node.useRegex && node.pattern){
                        const regex = new RegExp(node.pattern, "i");
                        if(!regex.test(newValue)) trigger = false;
                    } else if(!newValue.includes(node.mustInclude)){
                        trigger = false;
                    }
                }

                // 5b️⃣ Alter Wert muss Text enthalten
                if(trigger && node.oldMustContain){
                    if(!lastValue.includes(node.oldMustContain)) trigger = false;
                }

                // 6️⃣ Wenn Trigger, dann msg weiterleiten
                if(trigger){
                    node.context().flow.set(flowKey, newValue);
                    node.lastTriggered[node.id] = now;
                    if(node.debug) node.warn(`Trigger: ${lastValue} → ${newValue}`);
                    return node.send(msg);
                }

                // 7️⃣ Änderung, aber kein Trigger → nur Status merken
                node.context().flow.set(flowKey, newValue);
                return null;
            }

            // 8️⃣ Keine Änderung → nichts tun
            return null;
        });
    }

    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}
