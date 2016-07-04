const token = "201884053:AAHFcpWnYYkt2RdJDfyZZ9z2C40aK9_AVVc";
var botApi = require('node-telegram-bot-api');
var bot = new botApi(token, {polling: true});
var newImgSearch = require('g-i-s');
var express = require('express');
var app = express();

app.set('port', (process.env.PORT || 5000));

//For avoiding Heroku $PORT error
app.get('/', function(request, response) {
    var result = 'App is running'
    response.send(result);
}).listen(app.get('port'), function() {
    console.log('App is running, server is listening on port ', app.get('port'));
});

// RELIC DATA
require('newrelic');


var searches = [
    'American Flag',
    'Statue of Liberty',
    'America',
    'American Freedom',
    'American Constitution',
    'Uncle Sam',
    'Monster Truck',
    'American Flag Car',
    `'Murica`,
    'Merica',
    '1950s Cars',
    'Bald Eagle',
    'FBI',
    'CIA',
    'US Government',
    'United States',
    'M16',
    'Texas',
    'Cowboys',
    'Patriots',
    'American Bald Eagle',
    'Burger',
    'Hot Dog'
]

function getImage(query) {
    return new Promise((resolve, reject) => {
        newImgSearch(query, (error, results) => {
            if (!error) {
                resolve(results);
            } else {
                reject(error);
            }
        });
    });
}

bot.onText(/^\/freedom/, (msg, match) => {
    var randSearch = Math.floor((Math.random() * searches.length) + 1);
    getImage(searches[randSearch]).then((result) => {
        var randImg = Math.floor((Math.random() * result.length) + 1);
        console.log(searches[randSearch], randSearch);
        bot.sendMessage(msg.chat.id, ('Searching for ' + searches[randSearch]) + ' ' + result[randImg].url);
    });
});

bot.onText(/^\/blaze/, (msg, match) => {
    getImage('fire').then((result) => {
        var randImg = Math.floor((Math.random() * result.length) + 1);
        console.log('Blaze:', randImg);
        bot.sendMessage(msg.chat.id, ('Blayz ' + result[randImg].url));
    });
});

bot.onText(/^\/img (.+)/, (msg, match) => {
    if (match[1] === 'penis') {
        bot.sendMessage(msg.chat.id, 'why would you do that??!!');
    }
    console.log('imgSearch', match[1]);
    getImage(match[1]).then((result) => {
        bot.sendMessage(msg.chat.id, result[0].url);
    });
});