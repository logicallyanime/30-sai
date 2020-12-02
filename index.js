var axios = require("axios");
const CronJob = require('cron').CronJob;
require('dotenv').config()
const RealDebridClient = require('node-real-debrid')
const RD = new RealDebridClient(process.env.DEBRID_TOKEN);
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');
var beau = require("json-beautify");
var events = require('events');
var consoler = new events.EventEmitter();
const PushToken = process.env.PUSH_TOKEN;
const LineToken = process.env.LINE_TOKEN;
var LastEp = parseInt(fs.readFileSync("LastEp"))
var forcedRun = false;
var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const statiData = { type: "link", channel_tag: "30-sai" }
var variData = { title: null, body: null, url: null, };
var data = {};
var Pushconfig = {
    method: 'post',
    url: 'pushes',
    baseURL: 'https://api.pushbullet.com/v2/',
    headers: {
        'Access-Token': PushToken,
        'Content-Type': 'application/json'
    },
    data: null
};

var LineConfig = {
    method: 'post',
    url: 'https://api.line.me/v2/bot/message/broadcast',
    headers: { 
      'Authorization': 'Bearer ' + LineToken, 
      'Content-Type': 'application/json'
    },
    data: null
  };


var isArray = (obj) => Object.prototype.toString.call(obj) === '[object Array]';

async function getBlogPost() {
    
    console.log("\nChecking ep status of Cherry Magic...");
    let request = await axios.default.get("https://irozuku.org/fansub/wp-json/wp/v2/posts");
    let json = await request.data;
    var cherry = {};
    for (let index = 0; index < json.length; index++) {
        if( isArray(json[index].tags)){
            if(json[index].tags.includes(50)){
                cherry = json[index];
                cherry.epNo = cherry.slug.substring(cherry.slug.length-2, cherry.slug.length);
                break;
            }
            else if(json[index].tags == 50){
                cherry = json[index];
                cherry.epNo = cherry.slug.substring(cherry.slug.length-2, cherry.slug.length);
                break;
            }
        }
    }
    
    let dom = new JSDOM(cherry.content.rendered);
    let banner = cherry.jetpack_featured_media_url
    let embedLink = dom.window.document.body.getElementsByTagName('iframe')[0].src
    let oldLink = dom.window.document.body.getElementsByTagName('a')[0].href
    let check = await CheckPost(oldLink, cherry.epNo);
    
    if (check.new) {
        console.log("New ep, creating link...");
        let newLink = await RD.unrestrict.link(oldLink);
        console.log("Link created!");
        // SetVariData("New Cherry Magic Episode Available", `Episode ${parseInt(cherry.epNo)} is now up!`, newLink.download + ".mp4");
        UpdateLineData(parseInt(cherry.epNo),embedLink,(newLink.download + ".mp4"), banner);
        console.log("Sending notification...");
        makeRequest(LineConfig);
    } 
    else if (!check.new) return;
    else{
        logError(cherry);
        SetVariData("An error has occured, check the log file.", `Check your fucking code`);
        UpdatePushData();
        makeRequest(Pushconfig)
    }
    if(job.running){
        job.stop();
        console.log("Check post completed, Blog Checker Job stopped.");
        return;
    } else if (forcedRun){
        forcedRun = false
        console.log("Check post completed forced run!");
    } 
    else console.log("Check post completed, yet Blog Checker Job is not running...");
}

function SetVariData(title = null,body = null, url = null) {
    variData.title = title;
    variData.body = body;
    variData.url = url;
}


function logError(cherry) {
    let log = {
        link: cherry.link,
        body: cherry.content,
        CurrentEp: cherry.epNo,
        LastEp: LastEp,
    }
    fs.writeFileSync("error.log",beau(log, null, 2, 100));
}

async function CheckPost(link, curEp) {
    let check = {};
    check.errors = false;
    if (!link.includes("mediafire")) {
        check.errors = true;
        return check;
    }
    if(curEp > LastEp){
        check.new = true;
        LastEp = curEp;
        fs.writeFileSync("LastEp",curEp);
        return check;
    }
    else if( curEp == LastEp ) check.new = false;
    else check.errors = true;
    return check;
}

function UpdatePushData() {
    data = { ...variData, ...statiData }
    Pushconfig.data = JSON.stringify(data);
}

function UpdateLineData(epNo, emLink, KodiLink, banner) {
    data = {"messages":[{"type":"flex","altText":`Episode ${epNo} is Now Available`,"contents":{"type":"bubble","size":"giga","hero":{"type":"image","url": banner,"size":"full","aspectRatio":"20:9","aspectMode":"cover","action":{"type":"uri","uri":emLink}},"body":{"type":"box","layout":"vertical","contents":[{"type":"text","text":"New Cherry Magic Episode Available","weight":"bold","size":"xl","align":"center"},{"type":"box","layout":"vertical","margin":"lg","spacing":"sm","contents":[{"type":"text","text":`Episode ${epNo} is now up!`,"wrap":true,"align":"center"}]}]},"footer":{"type":"box","layout":"vertical","spacing":"sm","contents":[{"type":"separator","margin":"xs"},{"type":"button","style":"link","height":"sm","action":{"type":"uri","label":"Open Player","uri":emLink},"color":"#007bff"},{"type":"button","style":"link","height":"sm","action":{"type":"uri","label":"Open in Kodi (via custom Kore)","uri":KodiLink},"color":"#007bff"}],"flex":0,"offsetBottom":"5px"}}}]}
    LineConfig.data = JSON.stringify(data);
}


//getBlogPost();

var job = new CronJob('0/30 * * * *', () => getBlogPost(), null, false, "America/New_York");

var jobJobber = new CronJob('0/15 12 * * 4', 
() => { 
    if(!job.running){
      job.start();
      console.log("Blog checker Job started");
      getBlogPost();
    }

}, null, false, "America/New_York");

jobJobber.start();

function getNextCheck(){
    if(job.running) return job.nextDate().fromNow();
    else return jobJobber.nextDate().format("[on] dddd, MMMM Do");
}

var getInput = () => {
    
    rl.question('Command: ', answer => {
        (answer != 'getInput' && consoler.eventNames().includes(answer)) ? consoler.emit(answer) : console.log("    No command by that name.");
        consoler.emit('getInput');
    });
}

var jobToggle = () => { 
    job.running ? job.stop() : job.start();
    console.log("    Blog Checker Job " + (job.running ? "Started." : "Stopped."));
}

var setCurEp = async () => {
    await rl.question("Ep no: ", answer => {
        if(answer < 30 && answer > 0) {
            LastEp = answer;
            console.log(`   Current Episode Set to ${answer}.`);
        } else console.log(`    Input ${answer} is invalid or out of bounds.`);
        consoler.emit('getInput');
    });
}

var lastCheck = () => console.log(`    Cherry Magic last checked on ${job.lastDate()}.\n    Next check is ${getNextCheck()}\n    Latest Episode is Episode ${LastEp}.`);

var currRunJobs = () => {
    console.log("    Blog Checker Job is " + (job.running? "running" : "not running"));
    console.log("    BC Initiator Job is " + (jobJobber.running? "running" : "not running"));
}

var forceCheck = () => {
    getBlogPost();
    forcedRun = true;
}
consoler.on('getInput', getInput);
consoler.on('lastCheck', lastCheck);
consoler.on('setCurEp', setCurEp);
consoler.on('jobToggle', jobToggle);
consoler.on('currRunJobs', currRunJobs);
consoler.on('forceCheck', forceCheck);
consoler.on('help', () => console.log(consoler.eventNames()));


consoler.emit('getInput');




function makeRequest(config) {
    axios(config)
    .then( console.log("Notification sent!") )
    .catch( (error) => console.log(error) );
}
