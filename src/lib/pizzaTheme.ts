export function setPizzaUrl(url: string) {
    document.documentElement.style.setProperty('--pizza-url', `url('${url}')`)
}

export function enablePizzaTheme() {
    document.body.classList.add('pizza-mode')

    // Use the pizza asset - you'll need to add pizza.png to src/assets/
    const pizzaUrl = new URL('../assets/pizza.png', import.meta.url).href
    setPizzaUrl(pizzaUrl)
}