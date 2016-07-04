const token = "201884053:AAHFcpWnYYkt2RdJDfyZZ9z2C40aK9_AVVc";
// const imgAPI = "AIzaSyA88SlhV40zJ98Z-Ozy9GvIJsYroS4qF6Y";
// const cseId = "011909804877856148840:kw4y0-sj8ik";

var botApi = require('node-telegram-bot-api');
// var googleImages = require('google-images');
// var imgSearch = googleImages(cseId, imgAPI);
var bot = new botApi(token, {polling: true});
var newImgSearch = require('g-i-s');


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



// OLD IMAGE SEARCHER


// bot.onText(/^\/freedom/, (msg, match) => {
//     var randSearch = Math.floor((Math.random() * searches.length) + 1);
//     var randPage = Math.floor((Math.random() * 3) + 1);
//     var randImg = Math.floor((Math.random() * 10) + 1);
//     console.log(randSearch, randPage, randImg);
//     imgSearch.search(searches[randSearch], {page: randPage}).then((result) => {
//         console.log(searches[randImg].url);
//         bot.sendMessage(msg.chat.id, ('Searching for ' + searches[randSearch]) + ' ' + result[randImg].url);
//     });
// });

// bot.onText(/^\/blaze/, (msg, match) => {
//     var randPage = Math.floor((Math.random() * 3) + 1);
//     var randImg = Math.floor((Math.random() * 10) + 1);
//     console.log('Blaze:', randPage, randImg);
//     imgSearch.search('fire', {page: randPage}).then((result) => {
//         console.log(result);
//         bot.sendMessage(msg.chat.id, ('Blayz ' + result[randImg].url));
//     });
// });

// bot.onText(/^\/img (.+)/, (msg, match) => {
//     console.log('imgSearch', match[1]);
//     imgSearch.search(match[1], {page: 1}).then((result) => {
//         bot.sendMessage(msg.chat.id, result[0].url);
//     });
// });

// GIS IMAGE SEARCHER

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