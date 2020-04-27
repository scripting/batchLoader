var myProductName = "batchLoader", myVersion = "0.5.2";

//Notes
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

const fnameConfig = "config.json", fnameLocationFile = "codeloc.json";

function addToLog (logfilelist) {
	const logfile = "data/" + utils.getDatePath () + "log.json";
	utils.sureFilePath (logfile, function () {
		fs.readFile (logfile, function (err, jsontext) {
			var jstruct = new Array ();
			if (!err) {
				jstruct = JSON.parse (jsontext);
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
	var parentfolder = "../", logarray = new Array ();
	var logfilelist = new Array ();
	fs.readdir (parentfolder, function (err, theListOfFiles) {
		function loadfolder (folder, callback) {
			//console.log (folder);
			var flocation = folder + fnameLocationFile;
			fs.readFile (flocation, function (err, jsontext) {
				if (err) {
					console.log (err.message);
					callback ();
					}
				else {
					var jstruct = JSON.parse (jsontext);
					//console.log ("folder == " + folder + ", s3path == " + jstruct.s3path);   
					folderloader.load (jstruct.s3path, folder, function (jsontext) {
						var jstruct = JSON.parse (jsontext);
						for (var x in jstruct) {
							logfilelist.push (x);
							}
						callback ();
						});
					//folderloader.load (jstruct.s3path, folder, function (logtext) {
						//if (logtext.length == 0) {
							//logtext = "No changes.";
							//}
						//logarray.push (logtext);
						//callback ();
						//});
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
readConfig (function () {
	//loopOverFolders (function (logfilelist) { //uncomment for local testing
		//if (logfilelist.length) {
			//addToLog (logfilelist);
			//}
		//console.log (utils.jsonStringify (logfilelist));
		//});
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
				loopOverFolders (function (logfilelist) {
					if (logfilelist.length) {
						addToLog (logfilelist);
						}
					theRequest.httpReturn (200, "application/json", utils.jsonStringify (logfilelist));
					});
				return;
			}
		theRequest.httpReturn (404, "text/plain", "Not found.");
		});
	utils.runEveryMinute (everyMinute);
	});
