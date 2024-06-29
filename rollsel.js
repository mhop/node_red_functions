
let sel=msg.payload;
flow.set('rollselect', sel);

let states=global.get('rollstate');
//node.log(`sel:${sel} rollstate:${JSON.stringify(states)}`);

let state=states[sel];
if(typeof(state)==='undefined') {
    state='??';
}
msg.payload=state;
return msg;
