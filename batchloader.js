var myProductName = "batchLoader", myVersion = "0.4.2";

//loads new code from several s3 locations
	//previous loaders just worked for a single app, 
	//this version can be configured to maintain many folders
	//11/26/18 by DW

const folderloader = require ("s3folderloader");
const utils = require ("daveutils");
const davehttp = require ("davehttp");  
const fs = require ("fs");  

var config = {
	port: 1408,
	flLogToConsole: true,
	flAllowAccessFromAnywhere: true, //for davehttp
	locations: [ 
		{
			s3path: "/bloatware.com/code/bloatbase/",
			folder: "../bloatbase/"
			}
		]
	};
const fnameConfig = "config.json";

function readConfig (callback) {
	utils.sureFilePath (fnameConfig, function () {
		fs.readFile (fnameConfig, function (err, data) {
			if (!err) {
				try {
					var jstruct = JSON.parse (data.toString ());
					for (var x in jstruct) {
						config [x] = jstruct [x];
						}
					}
				catch (err) {
					console.log ("readConfig: err == " + err.message);
					}
				}
			if (callback !== undefined) {
				callback ();
				}
			});
		});
	}
function loadAllFolders (callback) {
	var logarray = new Array ();
	function loadone (ix) {
		if (ix >= config.locations.length) {
			callback (logarray);
			}
		else {
			var loc = config.locations [ix], logtext;
			folderloader.load (loc.s3path, loc.folder, function (logtext) {
				if (logtext.length == 0) {
					logtext = "No changes.";
					}
				logarray.push (logtext);
				loadone (ix + 1);
				});
			}
		}
	loadone (0);
	}
function everyMinute () {
	var now = new Date ();
	if (now.getMinutes () == 0) { //only once per hour -- 9/25/19 by DW
		console.log (myProductName + " v" + myVersion + ": " + now.toLocaleTimeString () + ".\n");
		}
	readConfig ();
	}

readConfig (function () {
	davehttp.start (config, function (theRequest) {
		switch (theRequest.lowerpath) {
			case "/reload":
				loadAllFolders (function (logarray) {
					theRequest.httpReturn (200, "text/html", utils.jsonStringify (logarray));
					});
				return;
			}
		theRequest.httpReturn (404, "text/plain", "Not found.");
		});
	utils.runEveryMinute (everyMinute);
	});
