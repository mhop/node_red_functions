
let newstate=msg.payload;

// mqtt topic in fhemname wandeln
let ts=msg.topic.split('/');
if(ts[0]!='fhem' || ts[3]!='state') return;
if(!ts[2].includes("roll") && !ts[2].includes("Markise")) return;

let fhemname=ts[1]+'.'+ts[2];

//node.warn(`new state:${fhemname}:${newstate}`);

// save state
let states=global.get('rollsstate');
if (typeof states[fhemname] !== 'object') states[fhemname] = {};

states[fhemname].state=newstate;
if(newstate=='down' || newstate=='up') {
    states[fhemname].moved=newstate;
}

global.set('rollsstate', states);

// Rolladen Terr-Rechts offen lassen, wenn Markise runter
// closed down stop
if(fhemname=='Markise') {
    const markise_offen = newstate == 'open'
                       || newstate == 'open_ack'
                       || newstate == 'up';
    node.warn(`markise offen ${markise_offen}`);
    flow.set('markise_offen', markise_offen);
}

if(fhemname===flow.get('rollselect')) return msg;

return;
