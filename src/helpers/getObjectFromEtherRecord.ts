export function getObjectFromEtherRecord(data: any[]) {
  return Object.keys(data)
    .filter((i) => !parseInt(i) && !(parseInt(i) === 0))
    .map((i: any) => {
      const value = data[i]
      return { [i]: typeof value !== "string" ? value.toString() : value }
    })
    .reduce((acc, curr) => Object.assign(acc, curr), {})
}
