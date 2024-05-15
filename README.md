# ani-cli by DNA

**ani-cli** is a self-made CLI tool to find, watch or download anime from inside your terminal. This program uses puppeteer, a browser automation library, to scrape data from the web. In this case, all data including the stream itself is provided by [aniworld.to](https://aniworld.to), a german anime streaming site

## Usage

```
PS E:\ani-cli> deno run -A main.ts -?
Usage: ani-cli [options]

Find, watch or download anime from inside your terminal

Options:
 -h, --help          Show this help message
 -n, --name          Name of the anime
 -s, --search        Search for the anime
 -se,                Season and episode number combined (-> season.episode)
 -d, --download      Download the episode to the current directory

Example:
 ani-cli --name Horimiya -se 2.1 --download
```

## Custom location for binaries
There is a `env.template`-file. You can simply rename it to just `.env` and change the path's inside to your desired location. This is useful if you want to store the binaries in a different location than the default one