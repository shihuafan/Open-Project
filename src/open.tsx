import { Action, ActionPanel, Form, Icon, List, LocalStorage, open, showToast, Toast } from "@raycast/api";
import { useCallback, useEffect, useState } from "react";
import child_process from 'child_process'
import { getAllConfigFiles, getAppByLanguage, getLanguage } from "./util";
import getApps from "./util";

type State = {
    config: Config;
    projects: Project[];
    applications: Map<string, App>;
};

interface App {
    bundleId: string | undefined;
    icon: string;
    shell: string | undefined;
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

        getApps().then(apps => {
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

    const openInIDE = (project: Project) => {
        if (project.app.bundleId) {
            open(project.projectPath, project.app.bundleId)
        } else {
            try {
                child_process.exec(`${project.app.shell} ${project.projectPath}`)
            } catch (e) {
                showToast({
                    style: Toast.Style.Failure,
                    title: `Can not open in ${project.app.shell}`
                });
            }
        }
    }

    useEffect(() => {
        if (state.config.path.length == 0 || Array.from(state.applications.keys()).length == 0) {
            return
        }
        const tags = [''].concat(getAllConfigFiles())
        const script = state.config.path.map((path) => tags.map(tag => `$(ls -dt ${path}/${tag})`).join('\n')).join('\n')
        console.log(script)
        const projectWithLanguage = new Map<string, string | undefined>();
        child_process.execSync(`echo "${script}"`, { encoding: 'utf-8' }).
            split('\n').filter(item => item.length > 0).forEach(item => {
                projectWithLanguage.set(item.substring(0, item.lastIndexOf('/')), getLanguage(item.substring(item.lastIndexOf('/') + 1)))
            })
        const projects = Array.from(projectWithLanguage.entries()).map(values => {
            return {
                projectName: values[0].substring(values[0].lastIndexOf('/') + 1),
                projectPath: values[0],
                app: state.config.openby == "vscode" ? getAppByLanguage(undefined, state.applications) :
                    getAppByLanguage(values[1], state.applications)
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
                                <Action icon={project.app.icon} title="Open" onAction={() => { openInIDE(project) }} />
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
