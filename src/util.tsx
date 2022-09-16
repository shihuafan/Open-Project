import { getApplications } from "@raycast/api"
import fs from 'fs'
import bPlistParser from "bplist-parser";

const configFileWithLanguage = new Map(Object.entries({
    'go.mod': 'golang',
    'requirements.txt': 'python',
    'build.gradle': 'java',
    'pom.xml': 'java',
    'package.json': 'js'
}))

const languageWithApp = new Map(Object.entries({
    'golang': [
        { name: 'GoLand', shell: 'goland' }
    ],
    'java': [
        { name: 'IntelliJ IDEA', shell: 'idea' },
        { name: 'IntelliJ IDEA Ultimate', shell: 'idea' }
    ],
    'python': [
        { name: 'PyCharm Professional', shell: 'pycharm' },
        { name: 'PyCharm', shell: 'pycharm' },
        { name: 'PyCharm Community', shell: 'pycharm' },
    ],
    'js': [
        { name: 'WebStorm', shell: 'webstorm' }
    ],
    'c': [
        { name: 'CLion', shell: 'clion' }
    ],
    'cpp': [
        { name: 'CLion', shell: 'clion' }
    ]
}))

const terminalApp = ['iTerm', 'Terminal', 'Warp']

export function getAppByLanguage(filePath: string, apps: any[], defaultApp: any): any {
    const languages = fs.readdirSync(filePath).
        map(item => configFileWithLanguage.get(item)).
        map(item => item ? item : '').
        filter(item => item.length > 0)
    if (languages.length === 0) {
        return defaultApp
    }
    const target = languageWithApp.get(languages[0])?.map(item => {
        const app = apps.find(app => app.name == item.name)
        if (app) {
            app.shell = item.shell
            return app
        }
    }).filter(item => item !== undefined)
    return (target && target.length > 0) ? target[0] : defaultApp
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
                iconMatch = parsedData.match(/"CFBundleIconFile":"([\w\. ]+)",/)

            } else {
                iconMatch = data.match(/<key>CFBundleIconFile<\/key>\s*<string>([\w\. ]+)<\/string>/)
            }

            const iconPath = iconMatch ? iconMatch[1].endsWith('.icns') ?
                `${item.path}/Contents/Resources/${iconMatch[1]}` : `${item.path}/Contents/Resources/${iconMatch[1]}.icns` :
                'vscode.png'

            return {
                icon: iconPath,
                name: item.name,
                bundleId: item.bundleId,
                shell: undefined
            }
        })
}