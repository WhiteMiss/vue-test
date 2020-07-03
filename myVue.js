const compileType = {
    getValue(content, vm) {
        let result = content.split('.').reduce((data, currentVal) => {
            return data[currentVal]
        }, vm.$data)
        return result
    },
    setVal(content, vm, inputVal) {
        const array = content.split('.')
        let length = array.length
        array.reduce((data, currentVal) => {
            length--
            if (length === 0) {
                data[currentVal] = inputVal
            }
            return data[currentVal]
        }, vm.$data)
    },
    text(node, content, vm) {
        let value
        if (/\{\{(.+?)\}\}/.test(content)) {
            value = content.replace(/\{\{(.+?)\}\}/g, (...args) => {
                new Watcher(vm, args[1], (newVal) => {
                    this.updater.textUpdater(node, this.getContentVal(content, vm))
                })
                return this.getValue(args[1], vm)
            })

        }
        else {
            value = this.getValue(content, vm)
        }
        this.updater.textUpdater(node, value)
    },
    getContentVal(content, vm) {
        return content.replace(/\{\{(.+?)\}\}/g, (...args) => {

            return this.getValue(args[1], vm)
        })
    },
    html(node, content, vm) {
        const value = this.getValue(content, vm)
        new Watcher(vm, content, (newVal) => {
            this.updater.htmlUpdater(node, newVal)
        })
        this.updater.htmlUpdater(node, value)
    },
    model(node, content, vm) {
        const value = this.getValue(content, vm)
        //绑定更新函数 数据驱动视图
        new Watcher(vm, content, (newVal) => {
            this.updater.modelUpdater(node, newVal)
        })
        //视图影响数据 再由数据驱动视图
        node.addEventListener('input', e => {
            console.log('123')
            this.setVal(content, vm, e.target.value)
        })
        this.updater.modelUpdater(node, value)
    },
    on(node, content, vm, eventName) {
        let fn = vm.$options.methods && vm.$options.methods[content]
        node.addEventListener(eventName, fn.bind(vm), false);
    },
    bind(node, content, vm, eventName) {
        const value = this.getValue(content, vm)
        new Watcher(vm, content, (newVal) => {
            node.setAttribute(eventName, newVal)
        })
        node.setAttribute(eventName, value)

    },
    //更新函数
    updater: {
        textUpdater(node, value) {
            node.textContent = value
        },
        htmlUpdater(node, value) {
            node.innerHTML = value
        },
        modelUpdater(node, value) {
            node.value = value
        }
    }
}
class Compile {
    constructor(el, vm) {
        this.el = this.isElemengtNode(el) ? el : document.querySelector(el)
        this.vm = vm
        //1 获取文档碎片对象 并放入内存之中 可以减少页面的重排和重绘
        const fragment = this.node2Fragment(this.el)
        //2 编译文档碎片模板
        this.compile(fragment)
        //console.log(fragment);
        //3 追加子元素到根元素
        this.el.appendChild(fragment)
    }
    compile(fragment) {
        //1 获取每个子节点
        const childNodes = fragment.childNodes;
        [...childNodes].forEach(child => {
            if (this.isElemengtNode(child)) {
                //是元素节点 需要编译
                //console.log('元素节点', child)

                //判断子节点是否仍有孩子节点 若有则继续遍历
                if (child.childNodes && child.childNodes.length) {
                    this.compile(child)
                }
                this.compileElement(child)

            } else {
                //是文本节点
                //编译文本节点
                //console.log('文本节点', child)
                this.compileText(child)
            }

        })
    }
    compileElement(node) {//编译元素节点 如 v-html v-text
        let attributes = node.attributes
        attributes = [...attributes]
        attributes.forEach(attr => {
            const { name, value } = attr
            if (this.isDirective(name)) {
                const directive = name.split('-')[1] //text html model on:click
                const [dirName, eventName] = directive.split(':') //click
                compileType[dirName](node, value, this.vm, eventName)
                node.removeAttribute('v-' + directive)
            } else if (this.isEventName(name)) {//@click
                let [, eventName] = name.split('@')
                compileType['on'](node, value, this.vm, eventName)
                node.removeAttribute('@' + eventName)

            } else if (this.isBindName(name)) {//@click
                let [, eventName] = name.split(':')
                compileType['bind'](node, value, this.vm, eventName)
                node.removeAttribute(':' + eventName)
            }
        })
    }
    isEventName(attrName) {
        return attrName.startsWith('@')
    }
    isBindName(attrName) {
        return attrName.startsWith(':')
    }
    compileText(node) {//编译文本节点 如  {{}}
        const content = node.textContent
        if (/\{\{(.+?)\}\}/.test(content)) {
            compileType['text'](node, content, this.vm)
        }
    }
    isDirective(attrName) {
        return attrName.startsWith('v-')
    }
    node2Fragment(el) {
        //创建文档碎片
        const fragment = document.createDocumentFragment()
        let firstChild;
        while (firstChild = el.firstChild) {
            fragment.appendChild(firstChild)
        }
        return fragment
    }
    isElemengtNode(node) {//判断传入的是否为节点对象
        return node.nodeType === 1
    }
}
class myVue {
    constructor(options) {
        this.$el = options.el
        this.$data = options.data
        this.$options = options
        if (this.$el) {
            //1 实现一个数据观察者
            new Observer(this.$data)
            //2 实现指令解析器
            new Compile(this.$el, this)
            this.proxyData(this.$data)
        }
    }
    //this代理
    proxyData(data) {
        for (const key in data) {
            Object.defineProperty(this, key, {
                get() {
                    return data[key]
                },
                set(newVal) {
                    data[key] = newVal
                }
            })
        }
    }
}
class Observer {
    constructor(data) {
        this.observe(data)
    }
    observe(data) {
        if (data && typeof data === "object") {
            Object.keys(data).forEach(key => {
                this.defineReactive(data, key, data[key])
            })
        }
    }
    defineReactive(obj, key, value) {
        //递归遍历

        this.observe(value)
        //创建监视器 Dep
        const dep = new Dep()
        //劫持并监听所有的属性
        Object.defineProperty(obj, key, {
            enumerable: true,
            configurable: false,
            get() {
                //初始化的时候
                //订阅数组变化时，往Dep中添加观察者
                Dep.target && dep.addSub(Dep.target)
                return value
            },
            set: (newVal) => {
                this.observe(newVal)
                if (newVal !== value) {
                    value = newVal
                    //通知Dep的变化
                    dep.notify()
                }

            }
        })
    }
}
class Watcher {
    constructor(vm, content, callback) {
        this.vm = vm
        this.content = content
        this.callback = callback
        //先保存好原值
        this.oldVal = this.getOldVal()
    }
    getOldVal() {
        Dep.target = this;
        let result = compileType.getValue(this.content, this.vm)
        Dep.target = null;
        return result
    }
    update() {
        const NewVal = compileType.getValue(this.content, this.vm)
        if (NewVal != this.oldVal) {
            this.callback(NewVal)
        }
    }
}
class Dep {//1 通知 2收集 watcher
    constructor() {
        this.subs = []
    }
    addSub(watcher) {//添加观察者
        this.subs.push(watcher)
    }
    notify() {//通知观察者更新
        console.log("通知了观察者", this.subs);
        this.subs.forEach(watcher => {
            watcher.update()
        })
    }
}