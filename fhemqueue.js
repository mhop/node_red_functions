// msg: [fhemname]: zur Laufzeit evtl. überschreiben
//      payload: 0-geschlossen, 100-offen, 1-99-schlitz
//      topic: 'delayed'-Einqueuen und Wartezeit,
//             'stop':anhalten,
//             sonst-sofort senden

const tup=env.get('tup'); // Zeit hochfahren Schlitz sek
const tw =env.get('twait')*1000; // Zeit Runter abwarten msek

const max_delay_s = 120;
const wait_time_ms = 6100;
const check_timeout_ms = 120*1000;
const upslot=3;
msg.name=env.get('name');

let fhemname;
if(msg.fhemname !== undefined) fhemname=msg.fhemname;
else                           fhemname=env.get('fhemname');
if (!fhemname) return;
msg.fhemname = fhemname;

//node.warn(`fhemqueue ${fhemname} topic:${msg.topic} pl:${msg.payload}`);
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

    // neues Kommando-> evtl. schon vorhandene timer löschen
    //let timid=context.get('timid_up'); clearTimeout(timid);
    let states=global.get('rollsstate');
    if (typeof states[fhemname] !== 'object') states[fhemname] = {};
    //let timid=context.get('timid_up'); clearTimeout(timid);
	clearTimeout(states[fhemname].chk_tim); // neues Kommando->altes Weg
    clearTimeout(states[fhemname].up_tim);
    states[fhemname].chk_tim = null;
	global.set('rollsstate', states);

    if (msg.topic==='delayed') {
        msg.check = docheck;
        trySend(msg);
        node.warn(`main try ${fhemname}`);
    } else {
        enocean_send(msg);
    }
    return;
}

function trySend(msg)
{
    // msg in Queue eintragen.
    enocean_queue=global.get('enocean_queue')
    enocean_queue.push(msg);
    global.set('enocean_queue', enocean_queue);
    //node.warn(`q: ${JSON.stringify(enocean_queue, null, 4)}`);
    timid=global.get('enocean_timer');
    node.warn(`trysend ${msg.fhemname} t:${timid} ql:${enocean_queue.length}`);
    // senden wir schon ?
    if (timid == null) { // nein: los gehts
		enocean_send_timer()
    }
}

function enocean_send_timer() {
    let enocean_queue=global.get('enocean_queue')
    //node.warn(`timer ${JSON.stringify(enocean_queue, null, 4)}`);
    const l=enocean_queue.length;
    node.warn(`est send_timer ql:${l}`);
    let timid = null;
    if (l > 0) { // Daten vorhanden: ausqueuen und senden
        const msg=enocean_queue.shift();
        //node.warn(`fhemtest timer unq s ${JSON.stringify(msg,null,4)}`);
        global.set('enocean_queue', enocean_queue);
        enocean_send(msg);
        // timer starten -> warten bis nächstes gesendet werden darf.
		timid = setTimeout(()=>{ enocean_send_timer() }, wait_time_ms);
        node.warn(`est    unq:${msg.fhemname} timer start t:${timid} ql:${enocean_queue.length}`);
    }
    global.set('enocean_timer', timid);
}


function enocean_send(msg) {
    let plup = '';
    const fhemname=msg['fhemname'];
	if (msg.topic!=='fhem') { // FHEM Kommando ?
		// nein: fhem payload erstellen
		let pl=`set ${fhemname}`;
		node.warn(`es eno_send ${fhemname} pl:${msg.payload}`);
		if      (msg.topic==='stop') pl+=' stop';
		else if (msg.payload<=0)     pl+=' closes';
		else if (msg.payload>=100)   pl+=' opens';
		else if (msg.payload<100)  { // Beschattung
			node.warn("es    pl=up");
			plup=pl+` up ${tup}`;
			pl+=' closes';
		} else {
			node.error(`es   Payload illegal ${msg.payload}`);
			return;
		}
		msg.payload = pl;
		msg.topic = 'fhem'; // payload ist jetzt ein fhem-kommando
	}
    let states=global.get('rollsstate');
    if (typeof states[fhemname] !== 'object') states[fhemname] = {};
    if(msg.check) { // timer zum prüfen der Änderung des states starten
        msg.check = false; // beim Wiederholen kein neuer check-Timer
        msg.repeat = 0;
		clearTimeout(states[fhemname].chk_tim); // falls da schon ein timer läuft
        states[fhemname].chk_tim = setTimeout(()=>{ check_state(msg) }, check_timeout_ms);
        //node.warn(`es    check tim:${states[fhemname].chk_tim}`);
        states[fhemname].moved = "no";
    }
    node.send(msg);
    node.warn(`es    sent pl:${msg.payload}`);

    if (plup!='') { // wieder hochfahren für Schlitz
        node.warn(`es    plup: ${plup}`)
        let msgup = Object.assign({}, msg); // kopieren
        msgup.check = false;
        msgup.payload = plup;
		//let timid=context.get('timid_up');
		clearTimeout(states[fhemname].up_tim);
        states[fhemname].up_tim = setTimeout(()=>{ trySend(msgup); node.warn(`es    plup ${msgup.fhemname}`);}, tw);
        //context.set('timid_up', timid);
    }
    global.set('rollsstate', states);
}

function check_state(msg) {
    const fhemname=msg['fhemname'];
    let states=global.get('rollsstate');
    if (typeof states[fhemname] !== 'object') states[fhemname] = {};

    node.warn(`cs checkstate: ${fhemname} mv:${states[fhemname].moved}`);
    if(states[fhemname].moved=="no") {
        msg.repeat+=1;
        node.warn(`repeat: ${fhemname} ${msg.repeat}`);
        if(msg.repeat<=3) {
	        enocean_send(msg);
            // timer zum prüfen der Änderung des states erneut starten
	        clearTimeout(states[fhemname].chk_tim); // sicher ist sicher
            states[fhemname].chk_tim = setTimeout(()=>{ check_state(msg) }, check_timeout_ms);
            node.warn(`cs    roll repeated ${msg.payload}`);
        }
    } else {
		states[fhemname].chk_tim = null;
	}
	global.set('rollsstate', states);
}
