// ==UserScript==
// @name         Nico Manga Download
// @namespace    http://tampermonkey.net/
// @version      0.1
// @description  add a download button for Nico Nico Mangas
// @match        https://seiga.nicovideo.jp/watch/mg*
// @grant        none
// @require      https://cdnjs.cloudflare.com/ajax/libs/jszip/3.2.2/jszip.js
// @run-at       document-start
// ==/UserScript==

const svgData = `<?xml version="1.0" encoding="iso-8859-1"?> <!-- Generator: Adobe Illustrator 19.0.0, SVG Export Plug-In . SVG Version: 6.00 Build 0)  --> <svg version="1.1" id="Capa_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" x="0px" y="0px" viewBox="0 0 512 512" style="enable-background:new 0 0 512 512;" xml:space="preserve"> <g> <g> <path d="M382.56,233.376C379.968,227.648,374.272,224,368,224h-64V16c0-8.832-7.168-16-16-16h-64c-8.832,0-16,7.168-16,16v208h-64 c-6.272,0-11.968,3.68-14.56,9.376c-2.624,5.728-1.6,12.416,2.528,17.152l112,128c3.04,3.488,7.424,5.472,12.032,5.472 c4.608,0,8.992-2.016,12.032-5.472l112-128C384.192,245.824,385.152,239.104,382.56,233.376z"/> </g> </g> <g> <g> <path d="M432,352v96H80v-96H16v128c0,17.696,14.336,32,32,32h416c17.696,0,32-14.304,32-32V352H432z"/> </g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> <g> </g> </svg>`;
const svg = URL.createObjectURL(new Blob([svgData], {type: "image/svg+xml"}));

function decrypt(data, key) {
    let r, n = [], a = 8;
    for (r = 0; r < a; r++)
        n.push(parseInt(key.substr(2 * r, 2), 16));
    for (r = 0; r < data.length; r++)
        data[r] = data[r] ^ n[r % a];
    return data
}


function download(url, callbacks) {
    const key = getKeyFromUrl(url);

    const xhr = new XMLHttpRequest();

    xhr.open("GET", url);
    function getDataType(data) {
        let e = null, r = data.length;
        return 255 === data[0] && 216 === data[1] && 255 === data[r - 2] && 217 === data[r - 1] ? e = "jpg" : 137 === data[0] && 80 === data[1] && 78 === data[2] && 71 === data[3] ? e = "png" : 71 === data[0] && 73 === data[1] && 70 === data[2] && 56 === data[3] && (e = "gif"), e;
    }

    function getKeyFromUrl(url) {
        const e = url.match("/image/([a-z0-9_]+)/");
        if (null === e)
            return "";
        const r = e[1].split("_"), n = r[0];
        return n;
    }

    xhr.onload = function () {
        const data = decrypt(new Uint8Array(this.response), key);
        const type = getDataType(data);

        callbacks.end(data, type);
    };

    xhr.onprogress = callbacks.progress;

    xhr.responseType = "arraybuffer";
    xhr.send();
}

function triggerDownload(blob, filename) {
    const blobURI = URL.createObjectURL(blob);

    const anchor = document.createElement("a");
    anchor.download = filename;
    anchor.href = blobURI;

    anchor.click();
}

function generateArchive(images) {
    const zip = new JSZip();
    images.forEach(image => {
        zip.file(image.filename, image.data);
    });
    zip.generateAsync({type: "blob"}).then(function (archive) {
        const titleNode = document.body.querySelector(".episode_title");
        const title = titleNode ? titleNode.textContent : "chapter";
        triggerDownload(archive, `${title}.zip`);
    });
}

function downloadAll(links, progressCallback, endCallback) {
    const images = new Array(links.length);
    const nb = links.length;

    function downloadOne(index) {
        const url = links[index];

        if (!url) {
            generateArchive(images);
            endCallback();
            return;
        }

        download(url, {
            end(data, extension) {
                const filename = `${index + 1}.${extension}`;
                images[index] = {
                    filename,
                    data
                };

                progressCallback((index + 1) / nb);
                downloadOne(index + 1);
            },
            progress(event) {
                progressCallback((index + event.loaded / event.total) / nb)
            }
        });
    }

    downloadOne(0);
}

function createProgressBar() {
    const headerMode = document.querySelector(".header_mode");
    const header = document.getElementById("siteHeaderInner");
    const parent = header.parentElement;

    const div = parent.appendChild(document.createElement("div"));

    div.style.width = "100%";
    div.style.padding = "2px";
    div.style.boxSizing = "border-box";
    div.style.backgroundColor = "grey";

    const chunk = div.appendChild(document.createElement("div"));
    chunk.style.height = "20px";
    chunk.style.width = "0px";
    chunk.style.backgroundColor = "white";

    if (headerMode) {
        headerMode.style.marginTop = 36 + 22 + "px";
    }

    return {
        setProgress(progress) {
            chunk.style.width = 100 * progress + "%";
        },
        remove() {
            div.remove();
            if (headerMode) {
                headerMode.style.marginTop = 36 + "px";
            }
        }
    }
}

function addDownloadButton(links) {
    const titleElement = document.querySelector(".episode_title");

    if (titleElement) {
        const img = titleElement.appendChild(document.createElement("img"));
        img.style.height = "1em";
        img.src = svg;
        img.style.cursor = "pointer";
        img.style.marginLeft = "10px";
        img.addEventListener("click", main.bind(null, links));

        return true;
    }

    return false;
}

function main(links) {
    const progressbar = createProgressBar();
    downloadAll(links, progressbar.setProgress, progressbar.remove);
}

document.addEventListener("DOMContentLoaded", function () {
    const links = [];

    document.body.querySelectorAll("#page_contents [data-original]").forEach(link => links.push(link.dataset.original));

    if (!addDownloadButton(links)) {
        main(links);
    }
});
