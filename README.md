# batchLoader

Ping me to download stuff from S3 into local folders.

### How it works

At startup it loads a config.json file in the same folder. It uses the values in the file to override the defaults of the config bject. 

It's an HTTP server that handles two calls: 

1. /reload

Loops over the elements of config.locations, an array. Each element of the array is an object with two properties, s3path and folder. It then loops over the s3 location, and downloads any new or changed files to the folder. 

2. /reloadfolders

Loops over all the sibling folders to the batchLoader app, looking for a file named codeloc.json. In that file it looks for a property named s3path and downloads any new or changed files to the folder. This way when you move the folder, the codeloc.json file moves with it. You don't have to configure the local batchLoader app. Also in the future the functionality of batchLoader may be built into pagePark.

### Design

This is designed to plug into the Frontier-based code development system I have that stores all my code in S3 locations. 

Eventually this will allow updates to apps wtihout relying on Dropbox. 

