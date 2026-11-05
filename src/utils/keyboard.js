export function stopRowActivationPropagation(event) {
  if (event.key === 'Enter' || event.key === ' ') {
    event.stopPropagation();
  }
}
