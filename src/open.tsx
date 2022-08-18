import { Action, ActionPanel, Form, getApplications, Icon, List, LocalStorage, open, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import child_process from 'child_process'

type State = {
    config: Config;
    projects: Project[];
    applications: Map<string, App>;
};

interface App {
    bundleId: string | undefined;
    icon: string;
    tag: string[];
}
interface Config {
    path: string[];
    openby: string;
}

interface Project {
    projectName: string;
    projectPath: string;
    app: App;
}

export default function Command() {

    const [state, setState] = useState<State>({
        config: { path: [], openby: 'vscode' },
        projects: [],
        applications: new Map(),
    });

    useEffect(() => {
        LocalStorage.getItem<string>("config").then(configStr => {
            if (configStr) {
                const config: Config = JSON.parse(configStr);
                setState((previous) => ({ ...previous, config: config }));
            }
        }).catch(reason => {
            showToast({
                style: Toast.Style.Failure,
                title: "load fail, error: " + reason,
            });
        })

        getApplications().then(applications => {
            //com.microsoft.VSCode
            const configWithApp = new Map<string, App>()
            configWithApp.set('GoLand', { bundleId: '', icon: 'goland.svg', tag: ['go.mod'] })
            configWithApp.set('PyCharm Professional', { bundleId: '', icon: 'pycharm.svg', tag: ['requirement.txt'] })
            configWithApp.set('IntelliJ IDEA Ultimate', { bundleId: '', icon: 'idea.svg', tag: ['build.gradle', 'pom.xml'] })
            configWithApp.set('WebStorm', { bundleId: '', icon: 'webstorm.svg', tag: ['package.json'] })
            configWithApp.set('iTerm', { bundleId: '', icon: '', tag: ['item'] })

            const apps = new Map<string, App>()
            applications.forEach(application => {
                const app = configWithApp.get(application.name)
                if (app) {
                    console.log(application)
                    app.tag.forEach(t => {
                        apps.set(t, { bundleId: application.bundleId, icon: app.icon, tag: app.tag })
                    })
                }
            })
            setState((pre) => ({ ...pre, applications: apps }))
        })
    }, [])

    const openInBrowser = (path: string) => {
        try {
            const url = child_process.execSync(`awk '/url/{print $3}' ${path}/.git/config`, { encoding: 'utf-8' }).trim()
            const httpurl = url.startsWith('http') ? url : `https://${url.substring(4, url.length - 4).replace(':', '/')}`
            open(httpurl)
        } catch (e) {
            console.log(e)
            showToast({
                style: Toast.Style.Failure,
                title: "Can not open in Browser"
            });
        }
    }

    useEffect(() => {
        if (state.config.path.length == 0 || Array.from(state.applications.keys()).length == 0) {
            return
        }
        const tags = ['', 'go.mod', 'pom.xml', 'build.gradle', 'requirement.txt', 'package.json']
        const script = state.config.path.map((path) => tags.map(tag => `$(ls -dt ${path}/${tag})`).join('\n')).join('\n')
        console.log(script)
        const projectWithKey = new Map<string, string>();
        child_process.execSync(`echo "${script}"`, { encoding: 'utf-8' }).
            split('\n').filter(item => item.length > 0).forEach(item => {
                projectWithKey.set(item.substring(0, item.lastIndexOf('/')), item.substring(item.lastIndexOf('/') + 1))
            })
        const projects = Array.from(projectWithKey.entries()).map(values => {
            const app = state.applications.get(values[1])
            return {
                projectName: values[0].substring(values[0].lastIndexOf('/') + 1),
                projectPath: values[0],
                app: state.config.openby != "vscode" && app ? app : {
                    icon: "vscode.png",
                    bundleId: "com.microsoft.VSCode",
                    tag: [],
                }
            }
        })
        if (projects.length > 0) {
            setState((pre) => ({ ...pre, projects: projects }))
            console.log((`${state.projects.length}`))
        }
    }, [state.config, state.applications])

    const handleSubmit = useCallback(
        // save to storage and update
        (config: Config) => {
            LocalStorage.setItem("config", JSON.stringify(config)).then(() => {
                showToast({
                    style: Toast.Style.Success,
                    title: "save successed",
                });
                setState((previous) => ({ ...previous, config: config }));
            }).catch(reason => {
                showToast({
                    style: Toast.Style.Failure,
                    title: "save fail, error: " + reason,
                });
            })
        }, []
    );

    return (
        <List>
            {
                state.projects.length > 0 ? state.projects.map((project) => (
                    <List.Item
                        key={project.projectPath}
                        title={project.projectName}
                        subtitle={project.projectPath}
                        icon={project.app.icon}
                        actions={
                            <ActionPanel>
                                <Action.Open title="Open" application={project.app.bundleId} target={project.projectPath} />
                                <Action icon={Icon.Globe} title="OpenInBrowser" onAction={() => { openInBrowser(project.projectPath) }} />
                                <Action icon={Icon.Terminal} shortcut={{ modifiers: ["cmd"], key: "t" }} title="OpenInTerminal" onAction={() => {
                                    const bundleId = state.applications.get('item') ? state.applications.get('item')?.bundleId : 'com.apple.Terminal'
                                    open(project.projectPath, bundleId)
                                }} />
                                <ActionPanel.Section>
                                    <EditConfig config={state.config} handleSubmit={handleSubmit} />
                                </ActionPanel.Section>
                            </ActionPanel>
                        }
                    />
                )) : state.config.path.length > 0 ?
                    <List.Item
                        title='Loading ......'
                        icon={Icon.Circle}
                    /> :
                    <List.Item
                        title='Add New Project'
                        actions={
                            <ActionPanel>
                                <ActionPanel.Section>
                                    <EditConfig config={state.config} handleSubmit={handleSubmit} />
                                </ActionPanel.Section>
                            </ActionPanel>
                        }
                    />
            }
        </List>
    );
}

function EditConfig(props: { config: Config, handleSubmit: (newPath: Config) => void }) {
    return <Action.Push
        icon={Icon.Pencil}
        title="Edit Config"
        target={
            <Form actions={
                <ActionPanel>
                    <Action.SubmitForm title="Submit" onSubmit={(values) => {
                        props.handleSubmit({
                            path: values.project.split('\n'),
                            openby: values.openby,
                        })
                    }} />
                </ActionPanel>
            }>
                <Form.TextArea id='project' title='Projects' defaultValue={props.config.path.join('\n')} />
                <Form.Dropdown id="openby" title="Open by" defaultValue={props.config.openby}>
                    <Form.Dropdown.Item value="vscode" title="VsCode First" icon="vscode.png" />
                    <Form.Dropdown.Item value="jetbrain" title="JetBrain First" icon="jetbrain.png" />
                </Form.Dropdown>
            </Form>
        } />
}
