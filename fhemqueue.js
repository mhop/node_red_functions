// msg: [fhemname]: zur Laufzeit evtl. überschreiben
//      payload: 0-geschlossen, 100-offen, sonst-schlitz
//      topic: 'delayed'-Einqueuen und Wartezeit,
//             'stop':anhalten,
//             sonst-sofort senden

const tup=env.get('tup'); // Zeit hochfahren Schlitz sek
const tw =env.get('twait')*1000; // Zeit Runter abwarten msek

const max_delay_s = 120;
const wait_time_ms = 6100;
const upslot=3;
msg.name=env.get('name');

let fhemname;
if(typeof msg.fhemname!=='undefined') fhemname=msg.fhemname;
else                                  fhemname=env.get('fhemname');
if (!fhemname) return;
msg.fhemname = fhemname;

fhemqueue_main();

return;

// -------------------------------

function fhemqueue_main()
{
    // wenn der rollladen nicht gefahren ist->Befehl erneut senden
    let docheck=true;
    // die Rückmeldung der Aktoren arb.rollweg/terr funtioniert nicht->nicht überprüfen
    if (   fhemname == "arb.rollTerr"
        || fhemname == "arb.rollWeg") { docheck=false; }

    // neues Kommando-> evtl. schon vorhandenen up-timer löschen
    let timid=context.get('timid_up'); clearTimeout(timid);

    if (msg.topic==='delayed') {
        msg.check = docheck;
        trySend(msg);
    } else {
        enocean_send(msg);
    }
    return;
}


function trySend(msg)
{
    node.warn(`ttrysend ${fhemname} ${timid}`);
    //node.warn(`ttrysend q`);
    // in Queue eintragen.
    enocean_queue=global.get('enocean_queue')
    enocean_queue.push(msg);
    global.set('enocean_queue', enocean_queue);
    //node.warn(`q: ${JSON.stringify(enocean_queue, null, 4)}`);
    timid=global.get('enocean_timer');
    //senden wir schon ?
    if (timid == null) { // nein: los gehts
	enocean_send_timer()
    }
}


function enocean_send_timer() {
    let enocean_queue=global.get('enocean_queue')
    //node.warn(`timer ${JSON.stringify(enocean_queue, null, 4)}`);
    const l=enocean_queue.length;
    node.warn(`send_timer ${l}`);
    let timid = null;
    if (l > 0) { // Daten vorhanden: ausqueuen und senden
        const msg=enocean_queue.shift();
        //node.warn(`fhemtest timer unq s ${JSON.stringify(msg,null,4)}`);
        global.set('enocean_queue', enocean_queue);
        enocean_send(msg);
        // timer starten -> warten bis nächstes gesendet werden darf.
	timid = setTimeout(()=>{ enocean_send_timer() }, wait_time_ms);
        node.warn(`fhemtest timer start ${timid}`);
    }
    global.set('enocean_timer', timid);
}


function enocean_send(msg) {
    const fhemname=msg['fhemname'];
    // fhem payload erstellen
    let pl=`set ${fhemname}`;
    if      (msg.topic==='stop') pl+=' stop';
    else if (msg.payload<=0)     pl+=' closes';
    else if (msg.payload>=100)   pl+=' opens';
    else { // Beschattung
        plup=pl+` up ${tup}`;
        pl+=' closes';
    }
    msg.payload = pl;

    if(msg.check) { // timer zum prüfen der Änderung states starten
        //let moved=global.get('rollmoved');
        let states=global.get('rollsstate');
        states[fhemname].chk_tim = setTimeout(()=>{ check_state(msg) }, 120*1000);
	// todo ein evtl alter timer löschen
        states[fhemname].moved] = "no";
	//moved[fhemname]="no";
        //global.set('rollmoved', moved);
        global.set('rollsstate', moved);
        msg.repeat=0;
    }
    node.send(msg);
    //node.warn(`roll send ${msg.payload}`);

    if (plup!='') { // wieder hochfahren für Schlitz
        let msgup = Object.assign({}, msg);
        msgup.check = false;
        msgup.payload = plup;
        let timid=setTimeout(()=>{ trySend(msgup) }, tw);
        context.set('timid_up', timid);
    }
}

function check_state(msg) {
    const fhemname=msg['fhemname'];
    let moved=global.get('rollmoved');
    let states=global.get('rollsstate');
    //node.warn(`checkstate: set:${fhemname}/st:${oldstate}->${state};${targetstate}/${moved[fhemname]}`);
    //if(moved[fhemname]=="no") {
    if(states[fhemname].moved=="no") {
        msg.repeat+=1;
        node.warn(`repeat: ${fhemname} ${msg.repeat}`);
        if(msg.repeat<=3) {
	    enocean_send(msg);
            //node.send(msg);
            // timer zum prüfen der Änderung states erneut starten
            states[fhemname].chk_tim = setTimeout(()=>{ check_state(msg) }, 120*1000);
	    // todo ein evtl alter timer löschen
            node.warn(`roll repeated ${msg.payload}`);
        }
    }
}

function fhemqueue_main_alt()
{
    // wenn der rollladen nicht gefahren ist->Befehl erneut senden
    let docheck=true;
    // die Rückmeldung von  arb.rollweg/terr funtioniert nicht->nicht überprüfen
    if (   fhemname == "arb.rollTerr"
        || fhemname == "arb.rollWeg") { docheck=false; }
    let target='';

    const setval=msg.payload;
    // evtl. schon vorhandenen up-timer löschen
    let timid=context.get('timid_up'); clearTimeout(timid);
    let plup='';

    // fhem payload erstellen
    let pl=`set ${fhemname}`;
    if      (msg.topic==='stop') pl+=' stop';
    else if (setval<=0)          { pl+=' closes'; target='closed'; }
    else if (setval>=100)        { pl+=' opens'; target='open'; }
    else { // Beschattung
        plup=pl+` up ${tup}`;
        //node.log(`send slot pl:${plup} delay:${tw}`);
        pl+=' closes';
    }
    // state zum überprüfen, ob gefahren
    const states=global.get('rollstate');
    let state=states[fhemname];
    //node.warn(`send pl:${pl} st:${fhemname}/${docheck}`);

    if (msg.topic==='delayed') {
        // todo: komplette msg einqueuen
        //      msg.fhemname=fhemname;
        //      msg.chheck=docheck;
        trySend({payload: pl, startstate:state, targetstate:target,
             fhemname:fhemname, check: docheck});
    } else {
        node.warn(`roll send2 ${fhemname}`);
        node.send({payload: pl});
    }
    if (plup!='') {
        // todo: up-timer erst beim senden von down starten
        //      let msgup = Object.assign({}, msg);
        //      msgup.check=false;
        let timid=setTimeout(()=>{ trySend({payload: plup, check: false}) }, tw);
        context.set('timid_up', timid);
    }
    return;
}

function enocean_send_alt(msg) {
    const fhemname=msg['fhemname'];
    if(msg.check) {
        // timer zum prüfen der Änderung states starten
        setTimeout(()=>{ check_state(msg) }, 120*1000);

        let moved=global.get('rollmoved');
        moved[fhemname]="no";
        global.set('rollmoved', moved);

        msg.repeat=0;
    }
    node.send(msg);
    node.warn(`roll enocean send ${msg.payload}`);
    // timer starten -> warten bis nächstes gesendet werden darf.
    return setTimeout(()=>{ enocean_send_timer() }, wait_time_ms);
}
