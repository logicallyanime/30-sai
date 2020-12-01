var axios = require("axios");
const CronJob = require('cron').CronJob;
require('dotenv').config()
const RealDebridClient = require('node-real-debrid')
const RD = new RealDebridClient(process.env.DEBRID)
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');
var beau = require("json-beautify");
var events = require('events');
var consoler = new events.EventEmitter();
const AuthToken = process.env.TOKEN;
var LastEp = 0;
var firstRun = true;
var readline = require('readline');

var rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const statiData = { type: "link", channel_tag: "30-sai" }
var variData = { title: null, body: null, url: null, };
var data = { ...variData, ...statiData }

var config = {
    method: 'post',
    url: 'pushes',
    baseURL: 'https://api.pushbullet.com/v2/',
    headers: {
        'Access-Token': AuthToken,
        'Content-Type': 'application/json'
    },
    data: JSON.stringify(data)
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
    let oldLink = dom.window.document.body.getElementsByTagName('a')[0].href
    let check = await CheckPost(oldLink, cherry.epNo);
    
    if (check.new) {
        console.log("New ep, creating link...");
        let newLink = await RD.unrestrict.link(oldLink);
        console.log("Link created!");
        SetVariData("New Cherry Magic Episode Available", `Episode ${parseInt(cherry.epNo)} is now up!`, newLink.download + ".mp4");
        UpdateData();
        console.log("Sending notification...");
        makeRequest()
    } 
    else if (!check.new) return;
    else{
        logError(cherry);
        SetVariData("An error has occured, check the log file.", `Check your fucking code`);
        UpdateData();
        makeRequest()
    }
    if(job.running){
        job.stop();
        console.log("Check post completed, Blog Checker Job stopped.");
        return;
    } else if (firstRun){
        firstRun = false
        console.log("Check post completed first run!");
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
        let prev = await axios.default.get('https://api.pushbullet.com/v2/pushes', { headers: { 'Access-Token': AuthToken } });
        if(prev.data.pushes[0].body == `Episode ${parseInt(curEp)} is now up!`) {
            check.new = false;
            console.log("Notification has already previously been sent.")
        }
        return check;
    }
    else if( curEp == LastEp ) check.new = false;
    else check.errors = true;
    return check;
}

function UpdateData() {
    data = { ...variData, ...statiData }
    config.data = JSON.stringify(data);
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

var forceCheck = () => getBlogPost();

consoler.on('getInput', getInput);
consoler.on('lastCheck', lastCheck);
consoler.on('setCurEp', setCurEp);
consoler.on('jobToggle', jobToggle);
consoler.on('currRunJobs', currRunJobs);
consoler.on('forceCheck', forceCheck);
consoler.on('help', () => console.log(consoler.eventNames()));


consoler.emit('getInput');




function makeRequest() {
    axios(config)
    .then( console.log("Notification sent!") )
    .catch( (error) => console.log(error) );
}
