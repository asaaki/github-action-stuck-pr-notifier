<!-- spell-checker:ignore dependabot greenkeeper marr -->

# Stuck Pull Request Notifier GitHub Action

Automatically label and mention/notify a user about stuck pull requests.

This is primarily useful if you use a dependency update bot such as
[Dependabot][dependabot], [Greenkeeper][greenkeeper], or [Renovate][renovate]
and have configured their pull requests to be merged automatically.

This action will catch unmerged PRs that may be stuck because of a failing
GitHub status check, and will automatically remove the stuck label from
all closed or merged pull requests.

Pairs very well with the [Auto Approve action by Harry Marr][auto-approve].

## Usage

### Pre-requisites

Create a label in your repo to assign to stuck pull requests.

The default label this action uses is "stuck", but you can use any label.

**!!! The label must be setup before using this action. !!!**

### Inputs

:heavy_exclamation_mark: = Required

<table>
  <thead>
    <tr>
      <th width="1%">&nbsp;</th>
      <th width="20%">Input</th>
      <th width="10%">Default</th>
      <th width="69%">Description</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td>:heavy_exclamation_mark:</td>
      <td>repo-token</td>
      <td>&nbsp;</td>
      <td>Input for `secrets.GITHUB_TOKEN`.</td>
    </tr>
    <tr>
      <td>&nbsp;</td>
      <td>cutoff</td>
      <td>24h</td>
      <td>The cutoff time period before a pull request is considered stuck. The value will be passed to the <a href="https://www.npmjs.com/package/ms">ms</a> package.</td>
    </tr>
    <tr>
      <td>&nbsp;</td>
      <td>label</td>
      <td>stuck</td>
      <td>
        Name of the label to assign to stuck pull requests.<br /><br />
        <strong>The supplied label must already exist. This action will not create a new label.</strong>
      </td>
    </tr>
    <tr>
      <td>:heavy_exclamation_mark:</td>
      <td>message</td>
      <td>&nbsp;</td>
      <td>The comment message to post on the pull request to notify a user.</td>
    </tr>
    <tr>
      <td>:heavy_exclamation_mark:</td>
      <td>search-query</td>
      <td>&nbsp;</td>
      <td>
        Search query to pass to the pull request search.<br/><br />
        The value provided will be appended to the base search query, which looks something like this:<br />
        "repo:${GITHUB_REPOSITORY} is:pr is:open created:<=${createdSinceCutOff} -label:${stuckLabel}"
      </td>
    </tr>
  </tbody>
</table>

### Example workflow

Find and update [Dependabot][dependabot] pull requests that have not been automatically merged in 24 hours (default cutoff).

```yaml
name: Stuck PRs
on:
  schedule:
    - cron: '0 * * * *' # Run once per hour
jobs:
  stuck-prs:
    runs-on: ubuntu-latest
    steps:
      - uses: jrylan/github-action-stuck-pr-notifier@main
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          message: 'Hey @yourUsername, this PR appears to be stuck.'
          search-query: 'author:app/dependabot-preview author:app/dependabot'
```

## Related

- [Auto Approve action by Harry Marr][auto-approve]

## License

[ISC](https://github.com/jrylan/github-action-stuck-pr-notifier/blob/main/LICENSE.md)

[auto-approve]: https://github.com/marketplace/actions/auto-approve
[dependabot]: https://dependabot.com/
[greenkeeper]: https://github.com/marketplace/greenkeeper
[renovate]: https://github.com/marketplace/renovate
