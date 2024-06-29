

let sel=msg.payload;
flow.set('rollselect', sel);

let states=global.get('rollsstate');
//node.log(`sel:${sel} rollstate:${JSON.stringify(states)}`);

let state=states[sel].state;
if(typeof(state)==='undefined') {
    state='??';
}
msg.payload=state;
return msg;
