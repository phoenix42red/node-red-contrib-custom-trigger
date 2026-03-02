module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // Node-Konfiguration
        node.name = config.name || "";
        node.mustInclude = config.mustInclude || "";       // Textfilter optional
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.direction = config.direction || "Beide";      // "Ein→Aus", "Aus→Ein", "Beide"
        node.debug = config.debug || false;
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = config.cooldown || 0;

        node.lastTriggered = {};  // Zeitstempel für Cooldown
        const flowKey = `lastMsg_${node.id}`; // Flow-Context-Key

        node.on('input', function(msg) {
            // Aktueller Wert der kompletten Nachricht als String
            let newValue = JSON.stringify(msg);

            // Letzter bekannter Wert
            let lastValue = node.context().flow.get(flowKey) || "";

            // Trigger bei erster Nachricht
            if(!lastValue && node.triggerOnFirstMessage){
                node.context().flow.set(flowKey, newValue);
                if(node.debug) node.warn(`Trigger (erste Nachricht) ausgelöst: ${newValue}`);
                return msg;
            }

            // Cooldown prüfen
            let now = Date.now();
            if(node.lastTriggered[node.id] && (now - node.lastTriggered[node.id] < node.cooldown)) return null;

            // Prüfen, ob sich die msg geändert hat
            if(lastValue !== newValue){
                let trigger = false;

                // Richtung prüfen (nur relevant, wenn mustInclude gesetzt)
                if(node.mustInclude){
                    // Regex
                    let match = false;
                    if(node.useRegex && node.pattern){
                        const regex = new RegExp(node.pattern, "i");
                        match = regex.test(newValue);
                    } else {
                        match = newValue.includes(node.mustInclude);
                    }

                    if(!match){
                        // Wert enthält nicht gesuchten Text → nur Status merken
                        node.context().flow.set(flowKey, newValue);
                        return null;
                    }

                    // Ein→Aus
                    if((node.direction === "Ein→Aus" || node.direction === "Beide") &&
                       lastValue.includes(node.mustInclude) && newValue.includes("Aus")) trigger = true;

                    // Aus→Ein
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

            // keine Änderung → nichts tun
            return null;
        });
    }
    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}