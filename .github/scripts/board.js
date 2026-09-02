const STATUS = { inReview: "In review", done: "Done" };

const projectQuery = `
  query ($owner: String!, $number: Int!) {
    repositoryOwner(login: $owner) {
      ... on ProjectV2Owner {
        projectV2(number: $number) {
          id
          field(name: "Status") {
            ... on ProjectV2SingleSelectField {
              id
              options { id name }
            }
          }
        }
      }
    }
  }
`;

const pullRequestQuery = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      pullRequest(number: $number) {
        id
        closingIssuesReferences(first: 20) {
          nodes { id number }
        }
      }
    }
  }
`;

const issueQuery = `
  query ($owner: String!, $repo: String!, $number: Int!) {
    repository(owner: $owner, name: $repo) {
      issue(number: $number) { id number }
    }
  }
`;

const projectItemsQuery = `
  query ($contentId: ID!) {
    node(id: $contentId) {
      ... on Issue { projectItems(first: 20) { nodes { id project { id } } } }
      ... on PullRequest { projectItems(first: 20) { nodes { id project { id } } } }
    }
  }
`;

const addItemMutation = `
  mutation ($projectId: ID!, $contentId: ID!) {
    addProjectV2ItemById(input: { projectId: $projectId, contentId: $contentId }) {
      item { id }
    }
  }
`;

const updateStatusMutation = `
  mutation ($projectId: ID!, $itemId: ID!, $fieldId: ID!, $optionId: String!) {
    updateProjectV2ItemFieldValue(
      input: { projectId: $projectId, itemId: $itemId, fieldId: $fieldId, value: { singleSelectOptionId: $optionId } }
    ) {
      projectV2Item { id }
    }
  }
`;

async function loadProject(github, owner, number) {
  const { repositoryOwner } = await github.graphql(projectQuery, { owner, number });
  const project = repositoryOwner?.projectV2;

  if (!project?.field) {
    throw new Error(`Project ${number} of ${owner} has no "Status" field or is not visible to PROJECT_TOKEN.`);
  }

  return project;
}

function statusOptionId(project, statusName) {
  const option = project.field.options.find((candidate) => candidate.name === statusName);

  if (!option) {
    throw new Error(`The "Status" field has no "${statusName}" option.`);
  }

  return option.id;
}

async function projectItemId(github, project, contentId) {
  const { node } = await github.graphql(projectItemsQuery, { contentId });
  const existing = node.projectItems.nodes.find((item) => item.project.id === project.id);

  if (existing) {
    return existing.id;
  }

  const { addProjectV2ItemById } = await github.graphql(addItemMutation, { projectId: project.id, contentId });

  return addProjectV2ItemById.item.id;
}

async function moveToStatus({ github, core }, project, contents, statusName) {
  const optionId = statusOptionId(project, statusName);

  for (const content of contents) {
    const itemId = await projectItemId(github, project, content.id);

    await github.graphql(updateStatusMutation, {
      projectId: project.id,
      itemId,
      fieldId: project.field.id,
      optionId,
    });

    core.info(`#${content.number} -> ${statusName}`);
  }
}

async function pullRequestWithLinkedIssues(github, context) {
  const { repository } = await github.graphql(pullRequestQuery, {
    ...context.repo,
    number: context.payload.pull_request.number,
  });
  const pullRequest = repository.pullRequest;

  return [
    { id: pullRequest.id, number: context.payload.pull_request.number },
    ...pullRequest.closingIssuesReferences.nodes,
  ];
}

function targetStatusForPullRequest(payload) {
  const { action, pull_request: pullRequest } = payload;

  if (action === "closed") {
    return pullRequest.merged ? STATUS.done : undefined;
  }

  return pullRequest.draft ? undefined : STATUS.inReview;
}

async function moveItemsForEvent({ github, context, core }) {
  const project = await loadProject(github, context.repo.owner, Number(process.env.PROJECT_NUMBER));

  if (context.eventName === "issues") {
    const { repository } = await github.graphql(issueQuery, { ...context.repo, number: context.payload.issue.number });

    await moveToStatus({ github, core }, project, [repository.issue], STATUS.done);
    return;
  }

  const statusName = targetStatusForPullRequest(context.payload);

  if (!statusName) {
    core.info(`Nothing to move for pull request action "${context.payload.action}".`);
    return;
  }

  await moveToStatus({ github, core }, project, await pullRequestWithLinkedIssues(github, context), statusName);
}

module.exports = { moveItemsForEvent, STATUS };
