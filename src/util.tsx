import { getApplications } from "@raycast/api"
import fs from 'fs'
import bPlistParser from "bplist-parser";
import { App } from "./model";
import child_process from 'child_process'

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
    const shell = 'type ' + defaultJetbrainApps.map(item => item.shell).join(' ')
    const supportShell = child_process.execSync(shell, { encoding: 'utf-8' }).split('\n').map(item => item.split(' ')[0])
    const supportJetbrainApps = new Map()
    defaultJetbrainApps.filter(item => supportShell.indexOf(item.shell) >= 0).forEach(item => {
        item.configFile.forEach(cf => supportJetbrainApps.set(cf, item))
    })
    return supportJetbrainApps
}