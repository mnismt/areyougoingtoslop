const shareMessages = [
  (username: string) =>
    `we ran @${username}'s commits through the slop machine. the machine sighed first.`,
  (username: string) =>
    `@${username} pushed code. we pushed it into a suspiciously dark comedy routine.`,
  (username: string) =>
    `our model checked @${username}'s commit history and whispered, "interesting choices."`,
  (username: string) =>
    `@${username}'s repo has been inspected for ai fingerprints, cursed phrasing, and 2am confidence.`,
  (username: string) =>
    `we audited @${username}'s commits for signs of automation. the vibe report was immediate.`,
  (username: string) =>
    `@${username} met the slop detector. only one of them left emotionally unchanged.`,
  (username: string) =>
    `we asked whether @${username}'s commits were handcrafted. the timeline laughed.`,
  (username: string) =>
    `@${username}'s public commits entered the scanner and exited with a dramatic soundtrack.`,
  (username: string) =>
    `we reviewed @${username}'s github history for ai seasoning. subtle was not the word.`,
  (username: string) =>
    `@${username}'s commit log was analyzed for slop. satire remains fully enabled.`,
]

export const pickShareMessage = (username: string) => {
  const seed = username
    .toLowerCase()
    .split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0)

  return shareMessages[seed % shareMessages.length](username)
}
