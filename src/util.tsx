import { getApplications } from "@raycast/api"
import fs from 'fs'
import bPlistParser from "bplist-parser";
import { App, VscodeRemoteConfig } from "./model";
import child_process from 'child_process'
import { useSQL } from "@raycast/utils";
import { homedir } from "os";

const defaultJetbrainApps = [
    { name: 'GoLand', shell: 'goland', icon: 'goland.svg', configFile: ['go.mod'] },
    { name: 'IDEA', shell: 'idea', icon: 'idea.svg', configFile: ['build.gradle', 'pom.xml'] },
    { name: 'PyCharm', shell: 'pycharm', icon: 'pycharm.svg', configFile: ['requirements.txt'] },
    { name: 'WebStorm', shell: 'webstorm', icon: 'webstorm.svg', configFile: ['package.json'] },
    { name: 'CLion', shell: 'clion', icon: 'clion.svg', configFile: ['CMakeLists.txt'] },
]

const terminalApp = ['iTerm', 'Terminal', 'Warp']

export function getAppByLanguage(filePath: string, apps: Map<string, App>, defaultApp: App): App {
    const configFile = fs.readdirSync(filePath).find(f => apps.has(f))
    return (configFile && apps.has(configFile)) ? (apps.get(configFile) as App) : defaultApp
}

export function isTerminalApp(appName: string): boolean {
    return terminalApp.find(name => name == appName) != undefined
}

export async function getAllApp() {
    const applications = await getApplications()
    return applications.
        filter(item => fs.existsSync(`${item.path}/Contents/Info.plist`)).
        map(item => {
            const data = fs.readFileSync(`${item.path}/Contents/Info.plist`, 'utf8')
            let iconMatch: RegExpMatchArray | null

            if (data.startsWith('bplist')) {
                const parsedData = JSON.stringify(bPlistParser.parseFileSync(`${item.path}/Contents/Info.plist`))
                iconMatch = parsedData.match(/"CFBundleIconFile":"([\w. ]+)",/)

            } else {
                iconMatch = data.match(/<key>CFBundleIconFile<\/key>\s*<string>([\w. ]+)<\/string>/)
            }

            const iconPath = iconMatch ? iconMatch[1].endsWith('.icns') ?
                `${item.path}/Contents/Resources/${iconMatch[1]}` : `${item.path}/Contents/Resources/${iconMatch[1]}.icns` :
                undefined

            return {
                icon: iconPath,
                name: item.name,
                bundleId: item.bundleId,
                shell: undefined
            }
        })
}

export async function getJetBrainApps() {
    const supportJetbrainApps = new Map()
    try {
        const shell = 'type ' + defaultJetbrainApps.map(item => item.shell).join(' ')
        const supportShell = child_process.execSync(shell, { encoding: 'utf-8' }).split('\n').map(item => item.split(' ')[0])
        defaultJetbrainApps.filter(item => supportShell.indexOf(item.shell) >= 0).forEach(item => {
            item.configFile.forEach(cf => supportJetbrainApps.set(cf, item))
        })
    } catch (err) {
        console.log(err);
    }
    return supportJetbrainApps
}

export function loadVscodeConfig(): VscodeRemoteConfig[] {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data } = useSQL<any>(
        `${homedir()}/Library/Application Support/Code/User/globalStorage/state.vscdb`,
        "select * from ItemTable where key='ms-vscode-remote.remote-ssh';"
    );
    if (data) {
        const values = JSON.parse(data[0]['value'])['folder.history.v1']
        const hosts = Object.keys(values)
        const config = hosts.filter(host => !host.match(/\d+\.\d+\.\d+\.\d+/)).map(host => {
            return values[host].map((f: string) => { return { host: host, folder: f } })
        }).reduce((arr1, arr2) => arr1.concat(arr2))
        return config
    }
    return []
}