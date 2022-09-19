import { getApplications } from "@raycast/api"
import fs from 'fs'
import bPlistParser from "bplist-parser";
import { App } from "./model";
import child_process from 'child_process'

const configFileWithLanguage = new Map(Object.entries({
    'go.mod': 'go',
    'requirements.txt': 'python',
    'build.gradle': 'java',
    'pom.xml': 'java',
    'package.json': 'js'
}))

const defaultJetbrainApps = [
    { language: 'go', name: 'GoLand', shell: 'goland', icon: 'goland.svg' },
    { language: 'java', name: 'IDEA', shell: 'idea', icon: 'idea.svg' },
    { language: 'python', name: 'PyCharm', shell: 'pycharm', icon: 'pycharm.svg' },
    { language: 'js', name: 'WebStorm', shell: 'webstorm', icon: 'webstorm.svg' },
    { language: 'c', name: 'CLion', shell: 'clion', icon: 'clion.svg' },
    { language: 'cpp', name: 'CLion', shell: 'clion', icon: 'clion.svg' },
]

const terminalApp = ['iTerm', 'Terminal', 'Warp']

export function getAppByLanguage(filePath: string, apps: Map<string, App>, defaultApp: App): App {
    const languages = fs.readdirSync(filePath).
        map(item => configFileWithLanguage.get(item)).
        map(item => item ? item : '').
        filter(item => item.length > 0)
    return (languages.length > 0 && apps.has(languages[0])) ? (apps.get(languages[0]) as App) : defaultApp
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
    defaultJetbrainApps.filter(item => supportShell.indexOf(item.shell) >= 0).forEach(item => supportJetbrainApps.set(item.language, item))
    return supportJetbrainApps
}