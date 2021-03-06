const Configuration = require('../lib/configuration')
const fetch = require('node-fetch')
const checks = require('../lib/checks')

class Handler {
  static async handleIssues (context) {
    if (context.payload.issue.pull_request) {
      let res = await fetch(context.payload.issue.pull_request.url)
      let pr = await res.json()
      context.payload.pull_request = pr
      return this.handle(context, pr)
    }
  }

  static async handleIssuesOpened (context) {
    var config = await Configuration.instanceWithContext(context)

    let issue = context.payload.issue
    let settings = config.settings.mergeable.issues || {}
    let validators = []
    let excludes = (settings.exclude)
      ? settings.exclude.split(',').map(val => val.trim()) : []
    let includes = [ 'title', 'label', 'milestone', 'description', 'projects', 'assignee' ]
      .filter(validator => excludes.indexOf(validator) === -1)

    includes.forEach(validator => {
      validators.push(require(`../lib/${validator}`)(issue, context, settings))
    })

    console.info(config)
    return Promise.all(validators).then(results => {
      let failures = results.filter(validated => !validated.mergeable)

      if (failures.length !== 0) {
        let description = `Mergeable Bot has found some errors with this issue`
        for (let validated of failures) {
          description += `\n \`\`\` ${validated.description} \`\`\``
        }
        console.info(description)
        context.github.issues.createComment(
          context.repo({ number: issue.number, body: description })
        )
      }
    }).catch(error => {
      // (jusx) This should never ever happen. Log it.
      console.error(error)
    })
  }

  static async handlePullRequest (context) {
    return this.handle(context, context.payload.pull_request)
  }

  static async handleChecks (context) {
    // @TODO handle checks rerun calls
  }

  static async handle (context, pullRequest) {
    const checkRunResult = await checks.create(context, 'Mergeable')
    // let the user know that we are validating if PR is mergeable

    var config = await Configuration.instanceWithContext(context)

    let settings = config.settings.mergeable.pull_requests || config.settings.mergeable
    let validators = []
    let excludes = (settings.exclude)
      ? settings.exclude.split(',').map(val => val.trim()) : []
    let includes = [ 'approvals', 'title', 'label', 'milestone', 'description', 'projects', 'assignee' ]
      .filter(validator => excludes.indexOf(validator) === -1)

    includes.forEach(validator => {
      validators.push(require(`../lib/${validator}`)(pullRequest, context, settings))
    })

    console.info(config)
    return Promise.all(validators).then(results => {
      let failures = results.filter(validated => !validated.mergeable)

      let status, description
      if (failures.length === 0) {
        status = 'success'
        description = 'Okay to merge.'
      } else {
        status = 'failure'
        description = failures
          .map(validated => validated.description)
          .join(',\n')
      }

      checks.update(
        context,
        checkRunResult.data.id,
        'Mergeable',
        'completed',
        status,
        {
          title: `Result: ${status}`,
          summary: description})

      console.info({state: status, description: description})
    }).catch(error => {
      // (jusx) This should never ever happen. Log it.
      console.error(error)
    })
  }
}

module.exports = Handler
