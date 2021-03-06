const Helper = require('../__fixtures__/helper')
const Handler = require('../lib/handler')
const Configuration = require('../lib/configuration')
Configuration.DEFAULTS.approvals = 0

test('handlePullRequest when it is mergeable', async () => {
  let context = mockContext('title')
  await expectSuccessStatus(context)
})

test('handlePullRequest when it is NOT mergeable', async () => {
  let context = mockContext('wip')

  Handler.handlePullRequest(context).then(() => {
    expect(context.repo).toHaveBeenLastCalledWith(
      expect.objectContaining(Helper.expectedStatus('failure', 'Title contains "wip|dnm|exp|poc"'))
    )
  })
})

test('handle creates pending status', async () => {
  let context = mockContext()

  await Handler.handlePullRequest(context).then(() => {
    expect(context.repo).toBeCalledWith(
      expect.objectContaining({status: 'in_progress'})
    )
  })
})

test('one exclude configuration will exclude the validation', async () => {
  let context = Helper.mockContext({ title: 'wip', body: 'body' })
  context.repo = mockRepo()

  context.github.repos.getContent = () => {
    return Promise.resolve({ data: { content: Buffer.from(`
      mergeable:
        approvals: 0
        exclude: 'title'
    `).toString('base64') }})
  }
  await expectSuccessStatus(context)
})

test('more than one exclude configuration will exclude the validation', async () => {
  let context = Helper.mockContext({ title: 'wip', label: ['proof of concept'], body: 'body' })
  context.repo = mockRepo()

  context.github.repos.getContent = () => {
    return Promise.resolve({ data: { content: Buffer.from(`
      mergeable:
        exclude: 'approvals, title, label'
    `).toString('base64') }})
  }
  await expectSuccessStatus(context)
})

// TODO add tests for handleIssues

const expectSuccessStatus = async (context) => {
  await Handler.handlePullRequest(context)
    .then(() => {
      expect(context.repo).lastCalledWith(
        expect.objectContaining(Helper.expectedStatus('success', 'Okay to merge.'))
      )
    })
}

const mockContext = (title) => {
  let context = Helper.mockContext({ title: title, body: 'body' })
  context.repo = mockRepo()
  return context
}

const mockRepo = () => {
  return jest.fn((arg) => {
    if (!arg) return { owner: 'owner', repo: 'repo' }
  })
}
