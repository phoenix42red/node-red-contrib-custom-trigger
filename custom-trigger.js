module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // --------------------------
        // Node-Konfiguration
        // --------------------------
        node.name = config.name || "";
        node.msgPath = config.msgPath || "";           // z.B. payload, data.attributes.tomorrow_valid
        node.mustInclude = config.mustInclude || "";   // Textfilter optional
        node.oldMustContain = config.oldMustContain || ""; // Optional für alten Wert
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.direction = config.direction || "Beide";  // "Ein→Aus", "Aus→Ein", "Beide"
        node.debug = config.debug || false;
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = config.cooldown || 0;

        node.lastTriggered = {};  // Zeitstempel für Cooldown
        const flowKey = `lastMsg_${node.id}`; // Flow-Context-Key

        // --------------------------
        // Eingehende Nachrichten verarbeiten
        // --------------------------
        node.on('input', function(msg) {
            // --------------------------
            // Wert aus msg anhand msgPath holen
            // --------------------------
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

            // Immer als String behandeln
            newValue = (typeof newValue === "object") ? JSON.stringify(newValue) : String(newValue || "");

            // Letzter bekannter Wert
            let lastValue = node.context().flow.get(flowKey) || "";

            // --------------------------
            // Trigger bei erster Nachricht
            // --------------------------
            if(!lastValue && node.triggerOnFirstMessage){
                node.context().flow.set(flowKey, newValue);
                if(node.debug) node.warn(`Trigger (erste Nachricht) ausgelöst: ${newValue}`);
                return msg;
            }

            // --------------------------
            // Cooldown prüfen
            // --------------------------
            let now = Date.now();
            if(node.lastTriggered[node.id] && (now - node.lastTriggered[node.id] < node.cooldown)) return null;

            // --------------------------
            // Prüfen, ob sich der Wert geändert hat
            // --------------------------
            if(lastValue !== newValue){
                let trigger = false;

                // --------------------------
                // Textfilter prüfen (optional)
                // --------------------------
                if(node.mustInclude){
                    let match = false;

                    if(node.useRegex && node.pattern){
                        const regex = new RegExp(node.pattern, "i");
                        match = regex.test(newValue);
                    } else {
                        match = newValue.includes(node.mustInclude);
                    }

                    // Optional: alter Wert muss enthalten
                    if(node.oldMustContain){
                        if(!lastValue.includes(node.oldMustContain)) match = false;
                    }

                    if(!match){
                        // Wert enthält nicht gesuchten Text → nur Status merken
                        node.context().flow.set(flowKey, newValue);
                        return null;
                    }

                    // Richtung prüfen
                    if((node.direction === "Ein→Aus" || node.direction === "Beide") &&
                       lastValue.includes(node.mustInclude) && newValue.includes("Aus")) trigger = true;

                    if((node.direction === "Aus→Ein" || node.direction === "Beide") &&
                       lastValue.includes("Aus") && newValue.includes(node.mustInclude)) trigger = true;

                } else {
                    // Kein Textfilter → jede Änderung triggert
                    trigger = true;
                }

                if(trigger){
                    node.context().flow.set(flowKey, newValue);
                    node.lastTriggered[node.id] = now;
                    if(node.debug) node.warn(`Trigger ausgelöst: ${lastValue} → ${newValue}`);
                    return msg;
                }

                // Änderung, aber kein Trigger → nur Status merken
                node.context().flow.set(flowKey, newValue);
                return null;
            }

            // Keine Änderung → nichts tun
            return null;
        });
    }

    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}