var myProductName = "batchLoader", myVersion = "0.5.4";  

//Notes
	//6/22/20 by DW
		//it will take a port assignment from process.env.PORT.
		//turns out domain apps have the current folder set to pagepark's folder
			//that's going to be weird at times, perhaps?
	//4/25/20 by DW
		//added call that loops over all folders looking for codeloc.json files and downloads changes from it
	//11/26/18 by DW
		//loads new code from several s3 locations
			//previous loaders just worked for a single app, 
			//this version can be configured to maintain many folders

const folderloader = require ("s3folderloader");
const utils = require ("daveutils");
const davehttp = require ("davehttp");  
const fs = require ("fs");  
const filesystem = require ("davefilesystem"); 

var config = { 
	port: process.env.PORT || 1408,
	flLogToConsole: true,
	flAllowAccessFromAnywhere: true, //for davehttp
	folderToLoopOver: "../",
	locations: [ 
		]
	};

const fnameConfig = "config.json", fnameLocationFile = "codeloc.json";

function addToLog (logfilelist) {
	const logfile = "data/" + utils.getDatePath () + "log.json";
	utils.sureFilePath (logfile, function () {
		fs.readFile (logfile, function (err, jsontext) {
			var jstruct = new Array ();
			if (!err) {
				try {
					jstruct = JSON.parse (jsontext);
					}
				catch (err) {
					console.log ("addToLog: err.message == " + err.message + ", logfile == " + logfile + ", jsontext == " + jsontext);
					}
				}
			jstruct.unshift ({
				when: new Date (),
				files: logfilelist
				});
			fs.writeFile (logfile, utils.jsonStringify (jstruct), function (err) {
				if (err) {
					console.log ("addToLog: err.message == " + err.message);
					}
				});
			});
		});
	}
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
function loadFromConfigList (callback) {
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
function loopOverFolders (completionCallback) { //4/25/20 by DW
	//Changes 
		//4/25/20; 11:18:44 AM by DW
			//Loop over the sibling directories. Start with a list like this -- 
				//[
					//".DS_Store",
					//"Icon\r",
					//"batchloader",
					//"freediskspace",
					//"ioserver",
					//"littleoutliner",
					//"package-lock.json",
					//"pagePark",
					//"startforever.opml",
					//"startforever.sh"
					//]
	var parentfolder = config.folderToLoopOver; //6/22/20 by DW
	//var parentfolder = "../";
	var logarray = new Array ();
	var logfilelist = new Array ();
	fs.readdir (parentfolder, function (err, theListOfFiles) {
		function loadfolder (folder, callback) {
			//console.log (folder);
			var flocation = folder + fnameLocationFile;
			fs.readFile (flocation, function (err, jsontext) {
				if (err) {
					//console.log (err.message);
					callback ();
					}
				else {
					var jstruct = JSON.parse (jsontext);
					console.log ("folder == " + folder + ", s3path == " + jstruct.s3path);   
					try {
						folderloader.load (jstruct.s3path, folder, function (jsontext) {
							var jstruct = JSON.parse (jsontext);
							for (var x in jstruct) {
								logfilelist.push (x);
								}
							callback ();
							});
						}
					catch (err) {
						console.log ("loadfolder: err.message == " + err.message);
						}
					}
				});
			}
		function loadone (ix) {
			if (ix >= theListOfFiles.length) {
				completionCallback (logfilelist);
				}
			else {
				var f = parentfolder + theListOfFiles [ix];
				fs.stat (f, function (err, stats) {
					if (err) {
						loadone (ix + 1);
						}
					else {
						if (stats.isDirectory ()) {
							loadfolder (f + "/", function () {
								loadone (ix + 1);
								});
							}
						else { //not a directory
							loadone (ix + 1);
							}
						}
					});
				}
			}
		loadone (0);
		});
	}
function everyMinute () {
	var now = new Date ();
	if (now.getMinutes () == 0) { //only once per hour -- 9/25/19 by DW
		console.log (myProductName + " v" + myVersion + ": " + now.toLocaleTimeString () + ".\n");
		}
	readConfig (); //you don't have to reboot to change the configuration
	}

console.log ("\n" + myProductName + " v" + myVersion + ", dirname == " + __dirname);

readConfig (function () {
	davehttp.start (config, function (theRequest) {
		switch (theRequest.lowerpath) {
			case "/now":
				theRequest.httpReturn (200, "text/plain", new Date ());
				return;
			case "/reload":
				loadFromConfigList (function (logarray) {
					theRequest.httpReturn (200, "text/html", utils.jsonStringify (logarray));
					});
				return;
			case "/reloadfolders": 
				try {
					loopOverFolders (function (logfilelist) {
						addToLog (logfilelist);
						theRequest.httpReturn (200, "application/json", utils.jsonStringify (logfilelist));
						});
					}
				catch (err) {
					console.log ("batchLoader: err.message == " + err.message);
					theRequest.httpReturn (500, "text/plain", err.message);
					}
				return;
			default:
				theRequest.httpReturn (404, "text/plain", "Not found.");
				return;
			}
		});
	utils.runEveryMinute (everyMinute);
	});
