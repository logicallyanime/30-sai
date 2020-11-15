var axios = require("axios");
const CronJob = require('cron').CronJob;
require('dotenv').config()
const RealDebridClient = require('node-real-debrid')
const RD = new RealDebridClient(process.env.DEBRID)
const jsdom = require("jsdom");
const { JSDOM } = jsdom;
const fs = require('fs');
var beau = require("json-beautify");



var AuthToken = process.env.TOKEN;

var LastEp = 0;

var variData = { 
    title: null,
    body: null,
    url: null,
};

const statiData = {
    type: "link",
    channel_tag: "30-sai"
}

var data = {
    ...variData,
    ...statiData
}

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



async function getBlogPost() {
    let request = await axios.default.get("https://irozuku.org/fansub/wp-json/wp/v2/posts");
    let json = await request.data;
    var cherry = {};
    function isArray(obj) {
        return Object.prototype.toString.call(obj) === '[object Array]';
    }
    for (let index = 0; index < json.length; index++) {
        console.log("index: " + index);
        if( isArray(json[index].tags)){
            if(json[index].tags.includes(50)){
                cherry = json[index];
                cherry.epNo = cherry.slug.substring(cherry.slug.length-2, cherry.slug.length);
                break;
                console.log("\nnot breaking");
            }
        }
        else if(json[index].tags == 50){
            console.log("\npassed third if");
            cherry = json[index];
            cherry.epNo = cherry.slug.substring(cherry.slug.length-2, cherry.slug.length);
            break;
            console.log("\nagain, not breaking");
        }
    }
    
    let dom = new JSDOM(cherry.content.rendered);
    let oldLink = dom.window.document.body.getElementsByTagName('a')[0].href
    let check = CheckPost(oldLink, cherry.epNo);
    let newLink = await RD.unrestrict.link(oldLink);
    cherry.link = newLink.download + ".mp4";
    

    if (check.new) {
        variData.title = "New Cherry Magic Episode Available";
        variData.body = `Episode ${parseInt(cherry.epNo)} is now up!`;
        variData.url = cherry.link;
        console.log(cherry.link);
        UpdateData();
        makeRequest()
    } else if (!check.new){
        return;
    } else{
        variData.title = "An error has occured";
        variData.body = `Check your fucking code`;
        variData.url = null;
        UpdateData();
        makeRequest()
    }
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

function CheckPost(link, curEp) {
    let check = {};
    check.errors = false;
    if (!link.includes("mediafire")) {
        logError(cherry);
        check.errors = true;
        return;
    }
    if(curEp > LastEp){
        check.new = true;
        LastEp = curEp;
        return check;
    } else if( curEp == LastEp ){
        check.new = false;
        return check;
    } else {
        check.errors = true;
        return check;
    }
    return check;
}

function UpdateData() {
    data = {
        ...variData,
        ...statiData
    }
    config.data = JSON.stringify(data);
}

var job = new CronJob('0/30 * * * 3-6,0', function () { getBlogPost() }, null, false, "America/New_York");


getBlogPost();
job.start();

function makeRequest() {
    
    axios(config)
        .then(function (response) {
            console.log(JSON.stringify(response.data));
        })["catch"](function (error) {
            console.log(error);
        });
    }
    