const express = require('express');
const request = require('request');
const app = express();
const bodyParser = require('body-parser');
const mongoClient = require('mongodb').MongoClient;
const fs = require('fs');
const async = require('async');
const compression = require('compression')
const helmet = require('helmet')

api_key = '700FB82E6669247765CE8996C33C8E88'

app.use(bodyParser.urlencoded({extended: true}))
app.use(compression());
app.use(helmet());
app.set('view engine','ejs')
app.use(express.static('public'))

var first = true;
var db;
var mongoDB = process.env.MONGODB_URI || 'mongodb://srini:narayan94@ds263707.mlab.com:63707/dota2';

mongoClient.connect(mongoDB, (err,database) => {
	if (err) return console.log(err)
	db = database.db('dota2')
	var port = process.env.PORT || 3000;
	app.listen(port, () => {
		console.log('Mongo client connected')
	})
})

const minutes = 2, the_interval = minutes * 60 * 1000;
setInterval(() => {
  console.log('Requesting Match data every '+minutes+' minutes');
  request('https://api.steampowered.com/IDOTA2Match_570/GetMatchHistory/v001?key='+api_key,{json:true},(err,res,body)=>{
  	if(err) return err;
  	try{
	  	async.each(body['result']['matches'],(item,callback)=>{
	  		addMatches('matches',item,(callback)=>{
	  			console.log('Added : Match '+callback)
	  		})
	  	},(err)=>{
	  		if(err) return console.log(err)
	  		console.log('Updated : Match Details')
	  	})
	}
	catch(err){
		console.log('Unable to add Matches')
	}
  })
  // do your stuff here
}, the_interval);

function addMatches(colName,query,callback){
	db.collection(colName).update({match_id:query['match_id']},
		query,
		{upsert:true},(err,result)=>{
			if(err) return console.log(err)	
			callback(query['match_id']);
		})
}

function getNames(callback){
	async.parallel([
		(callback)=>{
			db.collection('heroes').find({},{name:1}).toArray((err,result)=>{
				callback(null,result)
			})
		},
		(callback)=>{
			db.collection('items').find({},{name:1}).toArray((err,result)=>{
				callback(null,result)
			})
		}
	],(err,result)=>{
		if(err) return console.log(err)
		callback(result)	
	})
}

app.get('/', (req,res) => {
	if(first){
		first = false;
		res.redirect('/GetHeroesItems');
	}
	else{
		getNames((name)=>{
				res.render('index.ejs',{
					heroes:name[0],
					items:name[1]
				})
		})
	}
})

var downloadImg = (uri,filename,callback)=>{
	request(uri).pipe(fs.createWriteStream(filename)).on('close',callback);
}

app.get('/getImages', (req,res)=>{
	getNames((name)=>{
		async.parallel([
			(callback)=>{
				async.each(name[0],(item,callback)=>{
					downloadImg('http://cdn.dota2.com/apps/dota2/images/heroes/'+item.name+'_sb.png',__dirname+'/public/images/'+item.name+'.png',callback)
				},(err)=>{
					if(err) console.log(err)
					console.log('Updated : Hero images')
					callback()
				})
			},
			(callback)=>{
				async.each(name[1],(item,callback)=>{
					downloadImg('http://cdn.dota2.com/apps/dota2/images/items/'+item.name+'_lg.png',__dirname+'/public/images/'+item.name+'.png',callback)
				},(err)=>{
					if(err) console.log(err)
					console.log('Updated : Item images')	
					callback()
				})
			}
		],(err,result)=>{
			if(err) return console.log(err)
			res.redirect('/')
		});
	})
})

app.get('/getHeroesItems', (req,res) => {
	async.parallel([
		(callback)=>{
			request('https://api.steampowered.com/IEconDOTA2_570/GetHeroes/v0001?key='+api_key, {json:true},(err,res,body) => {
				if(err) return console.log(err)
				async.each(body['result']['heroes'],(item,callback)=>{
					var heroName = item.name.replace('npc_dota_hero_','')
					db.collection('heroes').update(
						{name:heroName},
						{name:heroName,id:item.id},
						{upsert:true},(err,result)=>{
							if(err) return console.log(err)				
					})
					callback()
				},(err)=>{
					if(err) return console.log(err)
					console.log('Updated : Hero names')
					callback()
				});
			})
		},
		(callback)=>{
			request('https://api.steampowered.com/IEconDOTA2_570/GetGameItems/v0001?key='+api_key, {json:true},(err,res,body) => {
				if(err) return console.log(err)
				async.each(body['result']['items'],(item,callback)=>{
					var itemName = item.name.replace('item_','')
					db.collection('items').update(
						{name:itemName},
						{name:itemName,id:item.id},
						{upsert:true},(err,result)=>{
							if(err) return console.log(err)	
					})
					callback()
				},(err)=>{
					if(err) return console.log(err)
					console.log('Updated : Item names')
					callback()
				});
			})
		}
	],(err,result)=>{
		if(err)	return console.log(err)
		res.redirect('/getImages')	
	});
})

app.all('*', function(req, res) {
  res.redirect('/');
});
