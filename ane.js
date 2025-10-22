(function() {
    if (window.location.origin === "https://animepahe.si") {
        console.log(
    '%c' + String.raw`
  /$$$$$$  /$$   /$$ /$$$$$$$$
 /$$__  $$| $$$ | $$| $$_____/
| $$  \ $$| $$$$| $$| $$
| $$$$$$$$| $$ $$ $$| $$$$$
| $$__  $$| $$  $$$$| $$__/
| $$  | $$| $$\  $$$| $$
| $$  | $$| $$ \  $$| $$$$$$$$
|__/  |__/|__/  \__/|________/
`,
    'font-family: monospace; white-space: pre; line-height: 1;'
  );
        AutoNextEpisode();
    } else {
        kwikPlayerMod();
    }
})();

function AutoNextEpisode() {
    const player = document.getElementsByTagName("iframe")[0];
    const temp_title = document.getElementsByTagName("title")[0].innerText;
    const episode_data = {type: "episode_data",
                          title: temp_title.match(/^(.*) Ep\. \d+ :: animepahe$/)[1],
                          episode: temp_title.match(/Ep\. (\d+)/)[1]}

    const bottomNavBar = document.getElementsByClassName("anime-season")[0];

    if (localStorage.getItem("skipOPED") == null) {
        localStorage.setItem("skipOPED", "false");
    }

    player.onload = () => {
        console.debug("[ANE] Sending title to iframe...");
        player.contentWindow.postMessage(episode_data, "*");
    }

    modUI();

    function modUI() {
        function toggleForward() {
            player.contentWindow.postMessage("toggleForward", "*")
        }

        function toggleSkip() {
            player.contentWindow.postMessage("toggleSkip", "*")
        }

        Button("Forward Button", toggleForward);
        Button("Skip OP/ED", toggleSkip);
    }

    function Button(label, onclick) {
        const button = document.createElement('button');
        button.style.backgroundColor = "#696969";
        button.style.border = "none";
        button.style.marginLeft = "1rem";
        button.style.borderRadius = "0.25rem";

        button.textContent = label;
        button.onclick = onclick;
        bottomNavBar.appendChild(button);
    }

    setTimeout(() => {
        console.debug("[ANE] (1) Auto next episode attached...");
        const btn = document.getElementsByClassName("reload")[0];
        if (btn) {
            btn.click();
        } else {
            console.error("Button not found");
        }
    }, 0);

    window.addEventListener('message', function(event) {
        if (event.origin !== 'https://kwik.cx') {
            return;
        }

        if (event.data === 'videoEnded') {
            console.log('[ANE] Video has ended');
            document.querySelector('a[title="Play Next Episode"]').click();
        }
    });
}

// ================================================================================== //W

async function kwikPlayerMod() {
    let MAL_ID;
    let EPISODE;
    let timestamps = {};
    const player = document.getElementById("kwikPlayer");
    console.debug("[ANE] " + (player == null ? "Failed to find player" : "(2) Successfully attached to player"));

    if (localStorage.getItem("hideForward") == null) {
        localStorage.setItem("hideForward", "true");
    }

    if (localStorage.getItem("skipOPED") == null) {
        localStorage.setItem("skipOPED", "false")
    }

    if (localStorage.getItem("requestFullscreen") === "true") {
        player.plyr.fullscreen.toggle();
        player.play();
        localStorage.setItem("requestFullscreen", "false");
    }

    checkVideoEnded();
    updateFoward();
    updateSkip();

    function updateFoward() {
        const button = document.getElementsByClassName("plyr__controls__item plyr__control")[2];
        if (localStorage.getItem("hideForward") == "true") {
            button.disabled = true;
            button.style.opacity = 0;

            window.addEventListener("keydown", blockRightArrow, true);
        } else {
            button.disabled = false;
            button.style.opacity = 1;

            window.removeEventListener("keydown", blockRightArrow, true);
        }
    }

    function blockRightArrow(e) {
        if (e.code === "ArrowRight") {
            e.preventDefault();
            e.stopPropagation();
        }
    }

    function updateSkip() {
        const playButton = document.getElementsByClassName("plyr__controls__item plyr__control")[0];
        if (localStorage.getItem("skipOPED") == "true") {
            playButton.style.color = "#90EE90";
        } else {
            playButton.style.color = "white";
        }
    }

    async function configureSkip() {
        timestamps.op = await getTime("op");
        timestamps.ed = await getTime("ed");

        if (timestamps.op == false && timestamps.ed == false) {
            return;
        }

        setInterval(() => {
            if (localStorage.getItem("skipOPED") != "true") { return }
            for (let type in timestamps) {
                if ((timestamps[type] != false) &&
                    (player.currentTime > timestamps[type].start_time) &&
                    (player.currentTime < timestamps[type].end_time)) {

                    let timeToSkipTo = timestamps[type].end_time;

                    if ((type == "ed") && ((player.duration - timeToSkipTo) <= 20)) {
                        timeToSkipTo = player.duration;
                    }

                    player.currentTime = timeToSkipTo;
                }
            }
        }, 300)
    }

    window.addEventListener('message', async function(event) {

        if (event.origin !== 'https://animepahe.si') {
            console.warn("Origin mismatch");
            return;
        }

        if (event.data === 'toggleForward') {
            if (localStorage.getItem("hideForward") === "true") {
                localStorage.setItem("hideForward", "false");
            } else {
                localStorage.setItem("hideForward", "true");
            }

            updateFoward();
            return;
        }

        if (event.data === 'toggleSkip') {
            if (localStorage.getItem("skipOPED") === "true") {
                localStorage.setItem("skipOPED", "false");
            } else {
                localStorage.setItem("skipOPED", "true");
            }

            updateSkip();
            return;
        }

        if (event.data && event.data.type === 'episode_data') {
            console.debug("[ANE] Received anime data");

            const query = `{
                     Media(search: "${event.data.title}", type: ANIME) {
                      idMal
                    }
                 }`;

            EPISODE = event.data.episode;
            MAL_ID = await
            fetch("https://graphql.anilist.co", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json",
                },
                body: JSON.stringify({ query }),
            })
                .then(response => response.json())
                .then(data => {
                return data.data.Media.idMal;
            })
                .catch(error => console.error("Error:", error));

            configureSkip();
        } else {
            console.warn("Unexpected message data: ", event.data);
        }
    });

    function checkVideoEnded() {
        var checkInterval = setInterval(() => {
            if (player.currentTime === player.duration) {
                window.parent.postMessage("videoEnded", "*");
                localStorage.setItem("requestFullscreen", "true");
                clearInterval(checkInterval);
            }
        }, 50);
    }

    async function getTime(type) {
        return await fetch(`https://api.aniskip.com/v1/skip-times/${MAL_ID}/${EPISODE}?types=${type}&episodeLength=${player.duration}`)
            .then(res => res.json())
            .then(data => {
            return data.results[0].interval})
            .catch(err => {
            console.log(`[ANE] No intervals found for the episode ${type}`);
            return false;
        });
    }
}
