import {homedir}  from 'os';
import { StatusResult } from 'simple-git';
import { z } from 'zod';
import color from 'picocolors';
import { execSync } from 'child_process';
import * as p from '@clack/prompts';
import fs from 'fs'
import { fromZodError } from 'zod-validation-error';
import { Config } from './zod-state';

export const CONFIG_FILE_NAME = '.better-commits.json'
export const SPACE_TO_SELECT = `${color.dim('(<space> to select)')}`
export const OPTIONAL_PROMPT =  `${color.dim('(optional)')}`
export const CACHE_PROMPT =  `${color.dim('(value will be saved)')}`
export const REGEX_SLASH_TAG = new RegExp(/\/(\w+-\d+)/)
export const REGEX_START_TAG = new RegExp(/^(\w+-\d+)/)
export const REGEX_SLASH_NUM = new RegExp(/\/(\d+)/)
export const REGEX_START_NUM = new RegExp(/^(\d+)/)
export const DEFAULT_TYPE_OPTIONS = [
    { value: 'feat', label: 'feat' , hint: 'A new feature', emoji: '✨'},
    { value: 'fix', label: 'fix' , hint: 'A bug fix', emoji: '🐛'},
    { value: 'docs', label: 'docs', hint: 'Documentation only changes', emoji: '📚'},
    { value: 'refactor', label: 'refactor', hint: 'A code change that neither fixes a bug nor adds a feature', emoji: '🔨'},
    { value: 'perf', label: 'perf', hint: 'A code change that improves performance', emoji: '🚀'},
    { value: 'test', label: 'test', hint: 'Adding missing tests or correcting existing tests', emoji: '🚨'},
    { value: 'build', label: 'build', hint: 'Changes that affect the build system or external dependencies', emoji: '🚧'},
    { value: 'ci', label: 'ci', hint: 'Changes to our CI configuration files and scripts', emoji: '🤖'},
    { value: 'chore', label: 'chore', hint: 'Other changes that do not modify src or test files', emoji: '🧹'},
    { value: '', label: 'none'},
]
export const DEFAULT_SCOPE_OPTIONS = [
    { value: 'app', label: 'app' },
    { value: 'shared', label: 'shared' },
    { value: 'server', label: 'server' },
    { value: 'tools', label: 'tools' },
    { value: '', label: 'none'},
]
export const COMMIT_FOOTER_OPTIONS = [
  { value: 'closes', label: 'closes <issue/ticket>', hint: 'Attempts to infer ticket from branch'},
  { value: 'breaking-change', label: 'breaking change', hint: 'Add breaking change'},
  { value: 'deprecated', label: 'deprecated', hint: 'Add deprecated change'},
  { value: 'custom', label: 'custom', hint: 'Add a custom footer'},
]
export const CUSTOM_SCOPE_KEY: 'custom' = 'custom'

export const Z_FOOTER_OPTIONS = z.enum(['closes', 'breaking-change', 'deprecated', 'custom'])
export const FOOTER_OPTION_VALUES: z.infer<typeof Z_FOOTER_OPTIONS>[] = ['closes', 'breaking-change', 'deprecated', 'custom']

/* LOAD */
export function load_setup(cli_name = ' better-commits '): z.infer<typeof Config> {
  console.clear();
  p.intro(`${color.bgCyan(color.black(cli_name))}`);

  const root = get_git_root();
  const root_path = `${root}/${CONFIG_FILE_NAME}`
  if (fs.existsSync(root_path)) {
    p.log.step('Found repository config')
    return read_config_from_path(root_path)
  }

  const home_path = get_default_config_path();
  if (fs.existsSync(home_path)) {
    p.log.step('Found global config')
    return read_config_from_path(home_path);
  } 

  const default_config = Config.parse({})
  p.log.step('Config not found. Generating default .better-commit.json at $HOME')
  fs.writeFileSync(home_path, JSON.stringify(default_config, null, 4));
  return default_config;
}

function read_config_from_path(config_path: string) {
  let res = null;
  try {
    res = JSON.parse(fs.readFileSync(config_path, 'utf8'))
  } catch (err) {
    p.log.error('Invalid JSON file. Exiting.\n' + err)
    process.exit(0);
  }

  return validate_config(res);
}

function validate_config(config: z.infer<typeof Config>): z.infer<typeof Config> {
  try {
    return Config.parse(config)
  } catch (err: any) {
    console.log(fromZodError(err).message);
    process.exit(0)
  }
}
/* END LOAD */

export function infer_type_from_branch(types: string[]): string {
  let branch = ''
  try {
    branch = execSync('git branch --show-current', {stdio : 'pipe' }).toString();
  } catch (err) {
    return ''
  }
  const found = types.find(t => {
    const start_dash = new RegExp(`^${t}-`)
    const between_dash = new RegExp(`-${t}-`)
    const before_slash = new RegExp(`${t}\/`)
    const re = [branch.match(start_dash), branch.match(between_dash), branch.match(before_slash)]
      .filter(v => v != null)
    return re?.length
  })

  return found ?? ''
}

export function get_git_root(): string {
  return execSync('git rev-parse --show-toplevel').toString().trim();
}

export function get_default_config_path(): string {
  return homedir()+'/'+CONFIG_FILE_NAME
}

export function check_missing_stage(stats: StatusResult): string[] {
  return stats.files.filter(f => f.index.trim() === '' || f.index === '?').map(f => f.path)
}

export function addNewLine(arr: string[], i: number) {
 return i === arr.length - 1 ? '' : '\n' 
}

export function clean_commit_title(title: string): string {
  const title_trimmed = title.trim();
  const remove_period = title_trimmed.endsWith('.')
  if (remove_period) {
    return title_trimmed.substring(0, title_trimmed.length - 1).trim();
  } 
  return title.trim()
}
