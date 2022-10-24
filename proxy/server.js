const http = require('http');
const { exec, execSync } = require("child_process");
const fs = require('fs');

const hostname = process.env.GCS_PROXY_HOST_NAME ? process.env.GCS_PROXY_HOST_NAME : '0.0.0.0';
const port = process.env.GCS_PROXY_PORT ? process.env.GCS_PROXY_PORT : 80;

const server = http.createServer((req, res) => {
    let token = '/tmp/credentials.json';
    let tokenData = '';
    if(!process.env.GOOGLE_APPLICATION_CREDENTIALS || process.env.GOOGLE_APPLICATION_CREDENTIALS == '') {
        if (!req.headers.authorization || req.headers.authorization.indexOf('Basic ') === -1) {
            res.statusCode = 401;
            res.end('Missing Authorization Header');
            return 
        }
        const base64Credentials =  req.headers.authorization.split(' ')[1];
        const credentials = Buffer.from(base64Credentials, 'base64').toString('ascii');
        const [username, password] = credentials.split(/:(.+)/);
        tokenData = password;
    } else {
        tokenData = process.env.GOOGLE_APPLICATION_CREDENTIALS;
    }

    fs.writeFileSync(token, tokenData);

    res.setHeader('Content-Type', 'text/plain');
    const [repoName, chartFile] = req.url.replace(/^\/|\/$/g, '').split('/');
    const host = req.headers.host;
    let schema = 'http';
    if (port == 443) {
        schema = 'https';
    }

    exec(`export GOOGLE_APPLICATION_CREDENTIALS=${token} && helm repo add ${repoName} gs://${repoName} && helm repo update `, {maxBuffer: (2048 * 2048) }, (error, stdout, stderr) => {
        if (error || stderr) {
            res.statusCode = 500;
            console.debug(error);
            res.end(stderr);
            return;
        }

        if (req.url.includes('.tgz')) {

            const chartUrl = `gs:/${req.url}`;
            const pullCommand = `export GOOGLE_APPLICATION_CREDENTIALS=${token} && helm pull --destination /tmp ${chartUrl}`;
            let pullResponse = '';
            try {
                pullResponse = execSync(pullCommand, {maxBuffer: (2048 * 2048) },).toString();
            } catch (error) {
                res.statusCode = 500;
                console.debug(error);
                res.end(stderr);
                return;
            }

            fs.readFile(`/tmp/${chartFile}`, (err, data) => {
                if (err) {
                    res.statusCode = 404;
                    console.log(err.message);
                    res.end(`Chart not found: ${chartUrl}`);
                    return;
                };
                res.statusCode = 200;
                res.setHeader('Content-Type', 'application/tar+gzip');
                res.end(data);
            });
        } else {
            exec(`export GOOGLE_APPLICATION_CREDENTIALS=${token} && cat $(helm env HELM_REPOSITORY_CACHE)/${repoName}-index.yaml `, {maxBuffer: (2048 * 2048) }, (error, stdout, stderr) => {
                if (error || stderr) {
                    res.statusCode = 500;
                    console.debug(error);
                    res.end(stderr);
                    return;
                }

                res.statusCode = 200;
                res.end(stdout.replace(/gs:\/\//g, schema + '://' + host + '/'));
            });
        }
    });

});

server.listen(port, hostname, () => {
    console.log(`Proxy running at http://${hostname}:${port}/`);
});

var signals = {
    'SIGHUP': 1,
    'SIGINT': 2,
    'SIGTERM': 15
};
const shutdown = (signal, value) => {
    console.log("shutdown!");
    server.close(() => {
        console.log(`server stopped by ${signal} with value ${value}`);
        process.exit(128 + value);
    });
};
Object.keys(signals).forEach((signal) => {
    process.on(signal, () => {
        console.log(`process received a ${signal} signal`);
        shutdown(signal, signals[signal]);
    });
});