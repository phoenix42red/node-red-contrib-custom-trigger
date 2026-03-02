module.exports = function(RED) {
    function CustomTriggerNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        // --------------------------
        // Node-Konfiguration
        // --------------------------
        node.name = config.name || "";
        node.msgPath = config.msgPath || "";           
        node.mustInclude = config.mustInclude || "";   
        node.oldMustContain = config.oldMustContain || ""; 
        node.useRegex = config.useRegex || false;
        node.pattern = config.pattern || "";
        node.debug = config.debug || false;
        node.triggerOnFirstMessage = config.triggerOnFirstMessage || false;
        node.cooldown = config.cooldown || 0;

        const flowKey = `lastValue_${node.id}`;
        node.lastTriggered = {};

        // --------------------------
        // Eingehende Nachrichten verarbeiten
        // --------------------------
        node.on('input', function(msg) {
            // Wert aus msg anhand msgPath holen
            let newValue;
            if(node.msgPath){
                try {
                    newValue = node.msgPath.split('.').reduce((obj, key) => obj && obj[key], msg);
                } catch(e){
                    newValue = undefined;
                }
            } else {
                newValue = msg; 
            }

            if (typeof newValue === "object") newValue = JSON.stringify(newValue);
            else if(newValue === undefined || newValue === null) newValue = "";
            else newValue = String(newValue);

            let lastValue = node.context().flow.get(flowKey) || "";

            // Trigger bei erster Nachricht
            if(!lastValue && node.triggerOnFirstMessage){
                node.context().flow.set(flowKey, newValue);
                node.status({fill:"blue",shape:"dot",text:`erste Nachricht: ${newValue}`});
                if(node.debug) node.warn(`Trigger (erste Nachricht) ausgelöst: ${newValue}`);
                return node.send(msg);
            }

            // Cooldown prüfen
            let now = Date.now();
            if(node.lastTriggered[node.id] && (now - node.lastTriggered[node.id] < node.cooldown)) {
                node.status({fill:"grey",shape:"ring",text:`Cooldown: ${newValue}`});
                return null;
            }

            // Prüfen, ob Wert geändert
            if(lastValue !== newValue){
                let trigger = true;

                // Neuer Wert muss Text enthalten
                if(node.mustInclude){
                    if(node.useRegex && node.pattern){
                        const regex = new RegExp(node.pattern, "i");
                        if(!regex.test(newValue)) trigger = false;
                    } else if(!newValue.includes(node.mustInclude)){
                        trigger = false;
                    }
                }

                // Alter Wert muss Text enthalten
                if(trigger && node.oldMustContain){
                    if(!lastValue.includes(node.oldMustContain)) trigger = false;
                }

                // Wenn Trigger, msg weiterleiten
                if(trigger){
                    node.context().flow.set(flowKey, newValue);
                    node.lastTriggered[node.id] = now;
                    node.status({fill:"green",shape:"dot",text:`Trigger: ${lastValue} → ${newValue}`});
                    if(node.debug) node.warn(`Trigger: ${lastValue} → ${newValue}`);
                    return node.send(msg);
                }

                // Änderung, aber kein Trigger
                node.context().flow.set(flowKey, newValue);
                node.status({fill:"yellow",shape:"ring",text:`geändert (kein Trigger): ${lastValue} → ${newValue}`});
                return null;
            }

            // Keine Änderung
            node.status({fill:"grey",shape:"ring",text:`keine Änderung: ${newValue}`});
            return null;
        });
    }

    RED.nodes.registerType("custom-trigger", CustomTriggerNode);
}
