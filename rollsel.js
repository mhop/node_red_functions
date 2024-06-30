
let sel=msg.payload;
flow.set('rollselect', sel);

let states=global.get('rollsstate');
if (typeof states[sel] !== 'object') states[sel] = {};
let state=states[sel].state;
//node.log(`sel:${sel} rollstate:${JSON.stringify(states)}`);

if(typeof(state)==='undefined') {
    state='??';
}
msg.payload=state;
return msg;
