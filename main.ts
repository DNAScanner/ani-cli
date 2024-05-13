import puppeteer from "https://deno.land/x/puppeteer@16.2.0/mod.ts";
import * as path from "https://deno.land/std@0.197.0/path/mod.ts";
import {DOMParser} from "https://deno.land/x/deno_dom@v0.1.45/deno-dom-wasm.ts";

const helpMessage = [
	//
	"Usage: ani-cli [options]",
	"",
	"Find, watch or download anime from inside your terminal",
	"",
	"Options:",
	" -h, --help          Show this help message",
	" -n, --name          Name of the anime",
	" -S, --search        Search for the anime",
	" -se,                Season and episode number combined (-> season.episode)",
	" -d, --download      Download the episode to the current directory",
	"",
	"Example:",
	" \x1b[32mani-cli\x1b[0m \x1b[33m--name\x1b[0m Horimiya \x1b[33m-se\x1b[0m 2.1 \x1b[33m--download\x1b[0m",
].join("\n");

let adblockPath = "C:/Users/liam/AppData/Local/Google/Chrome/User Data/Default/Extensions/cjpalhdlnbpafiamejdnhcphjbkeiagm";

try {
	adblockPath += "/" + Array.from(Deno.readDirSync(adblockPath))[0].name;
} catch {
	console.log(`uBlock Origin does not seem to be installed at ${adblockPath}`);
}

const wrapText = (text: string, width: number): string[] => {
	const words = text.split(" ");
	const lines: string[] = [];
	let currentLine = "";

	for (const word of words) {
		if ((currentLine + word).length + 1 > width) {
			lines.push(currentLine.trim());
			currentLine = "";
		}

		currentLine += word + " ";
	}

	if (currentLine.trim() !== "") lines.push(currentLine.trim());

	return lines;
};

const spinnerAnimation = async (signal: AbortSignal, message?: string, finishedMessage?: string) => {
	while (true) {
		for (const frame of ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]) {
			if (signal.aborted) {
				finishedMessage && console.log("\x1b[1M" + finishedMessage);
				return;
			}

			console.log(frame, (message || "") + "\x1b[1A");
			await new Promise((resolve) => setTimeout(resolve, 100));
		}
	}
};

const listAnime = (search: SearchResponseAnimeEntry[]) => {
	console.log("Search results:");
	for (const entry of search) {
		console.log(` ${search.indexOf(entry) + 1}. \x1b[32m` + entry.title + "\x1b[0m");
		const wrappedDescription = wrapText(entry.description, maxLineWidth);
		console.log(wrappedDescription.map((line) => " ".repeat(5) + line).join("\n") + "\n");
	}
};

const selectAnime = (search: SearchResponseAnimeEntry[]): SearchResponseAnimeEntry => {
	let selectedAnime: SearchResponseAnimeEntry | string = "";

	while (!selectedAnime) {
		const index = Number(prompt("Select an anime to watch (Number):") || 0) - 1;
		selectedAnime = search[index];
	}

	return selectedAnime as SearchResponseAnimeEntry;
};

type Data = {help: boolean; name: string; search: string; season: number; episode: number; episodeName?: string; download: string};

const browser = puppeteer.launch({
	executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
	defaultViewport: {width: 1920, height: 1080},
	// headless: false,
	args: [
		//
		`--disable-extensions-except=${adblockPath}`,
		`--load-extension=${adblockPath}`,
		"--mute-audio",
		"--no-sandbox",
	],
});

const data: Data = {
	help: Deno.args.includes("--help") || Deno.args.includes("-h") || Deno.args.includes("-?"),
	name: (Deno.args.includes("--name") && Deno.args[Deno.args.indexOf("--name") + 1]) || (Deno.args.includes("-n") && Deno.args[Deno.args.indexOf("-n") + 1]) || "",
	search: (Deno.args.includes("--search") && Deno.args[Deno.args.indexOf("--search") + 1]) || (Deno.args.includes("-S") && Deno.args[Deno.args.indexOf("-S") + 1]) || "",
	season: (Deno.args.includes("-se") && Number(Deno.args[Deno.args.indexOf("-se") + 1]?.split(".")[0])) || -1,
	episode: (Deno.args.includes("-se") && Number(Deno.args[Deno.args.indexOf("-se") + 1]?.split(".")[1])) || -1,
	episodeName: "",
	download: (Deno.args.includes("--download") && Deno.args[Deno.args.indexOf("--download") + 1]) || (Deno.args.includes("-d") && Deno.args[Deno.args.indexOf("-d") + 1]) || "",
};

// (async () => {
// 	while (true) {
// 		if (Deno.readTextFileSync("data.json") !== JSON.stringify(data, null, 6)) Deno.writeTextFileSync("data.json", JSON.stringify(data, null, 6));
// 		await new Promise((resolve) => setTimeout(resolve, 10));
// 	}
// })();

if (data.help) {
	console.log(helpMessage);
	Deno.exit(0);
}

// If name is not provided, clear all the other args
if (!data.name)
	while (!data.search) {
		data.season = -1;
		data.episode = -1;
		data.download = "";

		data.search = prompt("What anime are you looking for?") || "";
	}

const searchParams = new URLSearchParams();
searchParams.set("keyword", data.search || data.name);

type SearchResponseAnimeEntry = {
	title: string;
	description: string;
	link: string;
};

let animeUrl = "";

const animeSearchSpinner = new AbortController();
spinnerAnimation(animeSearchSpinner.signal, "Searching for anime...");

const search = (
	(await (
		await fetch("https://aniworld.to/ajax/search", {
			method: "POST",
			headers: {
				Cookie: "__ddg1_=5844PfcBzzt59IkeWB54; aniworld_session=sW9dkc8czZ1R1KPrjqW9ziIOAX",
				"Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
				"Content-Length": "0",
			},
			body: searchParams,
		})
	).json()) as SearchResponseAnimeEntry[]
)
	// 		"link": "\/anime\/stream\/rascal-does-not-dream-of-bunny-girl-senpai\/staffel-1\/episode-4"
	.filter((entry) => entry.link.startsWith("/anime/") && !entry.link.includes("staffel") && !entry.link.includes("episode"))
	.map((entry) => ({
		//
		...entry,
		title: entry.title.replaceAll(/<\s*\/?\s*em\s*>/gi, ""),
		description: entry.description.replaceAll(/<\s*\/?\s*em\s*>/gi, "").replaceAll(/&#\d+;/g, (match) => String.fromCharCode(Number(match.slice(2, -1)))),
	}));

const maxLineWidth = Math.min(64, Deno.consoleSize().columns - 4);
animeSearchSpinner.abort();

if (data.name) {
	// Check if there is an exact match (case insensitive)
	if (search.length === 1) {
		animeUrl = search[0].link;
		data.name = search[0].title;
	} else {
		listAnime(search);
		const {link, title} = selectAnime(search);
		animeUrl = link;
		data.name = title;
	}
} else {
	listAnime(search);
	const {link, title} = selectAnime(search);
	animeUrl = link;
	data.name = title;
}

animeUrl = "https://aniworld.to" + animeUrl;

const animePageSpinner = new AbortController();
spinnerAnimation(animePageSpinner.signal, "Loading anime page...");

const animePageText = await (await fetch(animeUrl)).text();
const animePageDom = new DOMParser().parseFromString(animePageText, "text/html");
const animePageSeasonsElements = Array.from(animePageDom?.querySelector("#stream > ul")?.querySelectorAll("li > a") || []);

const totalEpisodeUrls: string[][] = [];
animePageSpinner.abort();

const logSeasons = data.season === -1 || data.episode === -1;

logSeasons && console.log("Seasons:" + " ".repeat(16));
for (const element of animePageSeasonsElements) {
	let text = element.textContent;
	const isMovie = (element as unknown as HTMLAnchorElement)?.getAttribute("href")?.includes("film");
	const season = isMovie ? "0" : (element as unknown as HTMLAnchorElement)?.getAttribute("href")?.split("-").pop();
	const seasonEpisodeUrls: string[] = [];
	// If the text is just a number, add a prefix saying "Season"
	if (text === "Filme") text = "Movies";
	if (text.match(/^\d+$/)) text = "Season " + text;

	logSeasons && console.log(` ${animePageSeasonsElements.indexOf(element) + 1}. \x1b[32m${text}\x1b[0m`);

	const seasonPageText = await (await fetch("https://aniworld.to" + (element as unknown as HTMLAnchorElement).getAttribute("href"))).text();
	const seasonPageDom = new DOMParser().parseFromString(seasonPageText, "text/html");
	const seasonPageEpisodesElements = Array.from(seasonPageDom?.querySelector(`#season${season}`)?.querySelectorAll("tr > td > a") || []);
	for (const episodeElement of seasonPageEpisodesElements) {
		const string = "https://aniworld.to" + (episodeElement as unknown as HTMLAnchorElement).getAttribute("href") + "--" + (episodeElement as unknown as HTMLAnchorElement).querySelector("strong")?.textContent;
		if ((episodeElement as unknown as HTMLAnchorElement).querySelector("strong")?.textContent && !seasonEpisodeUrls.includes(string)) seasonEpisodeUrls.push(string);
	}

	for (const episode of seasonEpisodeUrls) logSeasons && console.log(" ".repeat(5) + (seasonEpisodeUrls.indexOf(episode) + 1) + ". \x1b[33m" + episode.split("--").pop() + "\x1b[0m");

	totalEpisodeUrls.push(seasonEpisodeUrls);
}

while (data.season === -1 || data.episode === -1) {
	const entered = (prompt("Select an episode to watch (season.episode):") || "").split(".");

	if (entered.length === 2 && !isNaN(Number(entered[0])) && !isNaN(Number(entered[1]))) {
		if (Number(entered[0]) <= totalEpisodeUrls.length && Number(entered[1]) <= totalEpisodeUrls[Number(entered[0]) - 1].length) {
			data.season = Number(entered[0]);
			data.episode = Number(entered[1]);
		}
	}
}
if (data.season < 1 || data.season > totalEpisodeUrls.length || data.episode < 1 || data.episode > totalEpisodeUrls[data.season - 1].length) {
	console.log("Invalid season or episode number");
	Deno.exit(1);
}

data.episodeName = totalEpisodeUrls[data.season - 1][data.episode - 1].split("--").pop() || "";

const seasonSpinner = new AbortController();
spinnerAnimation(seasonSpinner.signal, "Loading episode..." + " ".repeat(4));

const page = await (await browser)?.newPage();

await page?.goto(totalEpisodeUrls[data.season - 1][data.episode - 1].split("--")[0]);

let stream = "";

while (stream === "") {
	const html = [];
	html.push(await page?.content());
	for (const frame of page.frames()) html.push(await frame.content());

	// Now, find all urls containing "m3u8"
	stream = String(html.join("\n").match(/https:\/\/[^"]+\.m3u8.+"/g) || "").replaceAll('"', "");

	await new Promise((resolve) => setTimeout(resolve, 1000));
}

seasonSpinner.abort();

console.log("Found stream" + " ".repeat(8));

await (await browser)?.close();

// Possible options: Open in vlc, console.log the stream url, download the stream (with ffmpeg) (either as mp4, mov or m3u8 + ts)
// new Deno.Command("C:/Program Files/VideoLAN/VLC/vlc.exe", {args: [stream]}).spawn();

if (!data.download) {
	console.log("How would you like to watch this episode?");
	console.log(" 1. \x1b[32mOpen in VLC\x1b[0m");
	console.log(" 2. \x1b[32mPrint out stream URL\x1b[0m");
	console.log(" 3. \x1b[32mDownload episode\x1b[0m");

	let choice = 0;

	while (choice < 1 || choice > 3) choice = Number(prompt("Enter a number:") || 0);

	switch (choice) {
		case 1: {
			new Deno.Command("C:/Program Files/VideoLAN/VLC/vlc.exe", {args: [stream]}).spawn();
			break;
		}

		case 2: {
			console.log(stream);
			break;
		}

		case 3: {
			// mp4, mov or m3u8 + ts?
			console.log("What format would you like to download the episode in?");
			console.log(" 1. \x1b[32mMP4\x1b[0m");
			console.log(" 2. \x1b[32mMOV\x1b[0m");
			console.log(" 3. \x1b[32mM3U8 + TS\x1b[0m");

			let format = 0;

			while (format < 1 || format > 3) format = Number(prompt("Enter a number:") || 0);

			switch (format) {
				case 1: {
					data.download = "mp4";
					break;
				}

				case 2: {
					data.download = "mov";
					break;
				}

				case 3: {
					data.download = "m3u8";
					break;
				}
			}
			break;
		}
	}
}

console.log(data);

if (data.download) {
	const path = data.download === "m3u8" ? `downloads/${data.name}/${data.season}. ${data.episodeName}/` : `downloads/${data.name}/`;
	Deno.mkdirSync(path, {recursive: true});

	const args = [];

	args.push("-i", stream);
	if (data.download === "m3u8") args.push("-hls_time", "10", "-hls_list_size", "0", path + "master.m3u8");
	else args.push(path + `${data.season}. ${data.episodeName}.${data.download}`);

	const process = new Deno.Command("ffmpeg", {
		args: ["-i", stream, "-hls_time", "10", "-hls_list_size", "0", path + (data.download === "m3u8" ? "master.m3u8" : `${data.season}. ${data.episodeName}.${data.download}`)],
	}).spawn();

	await process.status;
}

Deno.exit(0);
