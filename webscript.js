// @ts-check

function addChild(element, child) {
  if (typeof child === "number"
    || typeof child === "boolean"
    || child instanceof Date
    || child instanceof RegExp) {
    element.append(String(child))
  }
  else if (Array.isArray(child)) {
    for (const childChild of child) {
      addChild(element, childChild);
    }
  }
  else {
    element.append(child);
  }
}

function createElement(tagName, props, ...children) {
  tagName = tagName.toLowerCase();
  const element = ["svg", "path", "title"].includes(tagName) ?
    document.createElementNS("http://www.w3.org/2000/svg", tagName) :
    document.createElement(tagName);
  for (let key in props) {
    let value = props[key];
    if (typeof value === "string") {
      if (key === "className") {
        key = "class"
      }
      element.setAttribute(key, value)
    }
    else {
      element[key] = value;
    }
  }
  for (const child of children) {
    addChild(element, child);
  }
  return element;
}


function joinStringsAndArgs(args) {
  const [strings, ...templateArgs] = args;
  const result = [];
  for (const [index, s] of strings.entries()) {
    result.push(s);
    result.push(templateArgs[index])
  }
  return result.join("");
}



function elementBuilderBuilder(elementConstructor, element) {
  function getPropertyValue(...args) {
    let [first] = args;
    if (typeof first === "undefined") {
      first = '';
    }
    else if (Array.isArray(first) && Object.isFrozen(first)) {
      first = joinStringsAndArgs(args);
    }
    let { props, prop } = this.__element_info__;
    props = { ...props, [prop]: first }
    return elementBuilder({ props, prop: null });
  }
  function getPropsValues(props) {
    let { props: existingProps } = this.__element_info__;
    props = { ...existingProps, ...props }
    return elementBuilder({ props, prop: null });
  }
  function elementBuilder(propsInfo) {
    let builder = new Proxy(() => { }, {
      apply(target, thisArg, args) {
        let [first] = args;
        if (Array.isArray(first) && Object.isFrozen(first)) {
          let first = joinStringsAndArgs(args).trim();
          let value = first.split(/[\s.]+/);
          let newProps = {};
          if (value.length > 0) {
            if (value[0].startsWith("#")) {
              newProps["id"] = value.shift().slice(1);
            }
          }
          let { props } = builder.__element_info__;
          if (value.length > 0) {
            let existingClassNames = props.className || "";
            if (typeof existingClassNames === "string" && existingClassNames.length > 0) {
              existingClassNames += " ";
            }
            newProps["className"] = existingClassNames + value.join(" ");
          }
          props = { ...props, ...newProps }
          return elementBuilder({ props, prop: null });
        }
        else {
          for (let i = 0; i < args.length; i++) {
            let arg = args[i];
            if (typeof arg === "function" && arg.__element_info__) {
              args[i] = arg();
            }
          }
          let { props } = builder.__element_info__;
          return elementConstructor(element, props, ...args);
        }
      },
      get(target, prop) {
        const result = target[prop];
        if (typeof result !== "undefined") {
          return result;
        }
        if (prop === "props") {
          return getPropsValues;
        }
        else if (typeof prop === "string") {
          if (prop.startsWith("data")) {
            prop = prop.replace(/[A-Z]/g, m => "-" + m.toLowerCase())
          }
          // @ts-ignore
          target.__element_info__.prop = prop;
          return getPropertyValue;
        }
      },
      set(target, prop, value) {
        target[prop] = value;
        return true;
      }
    })
    builder.__element_info__ = propsInfo;
    return builder;
  }
  return elementBuilder({ props: {}, prop: null });
}


function elementBuildersBuilder(elementConstructor = createElement, elements = []) {
  if (Object.prototype.toString.call(elementConstructor) === '[object Object]') {
    elementConstructor = elementConstructor["elementConstructor"] || createElement;
    elements = elementConstructor["elements"] || [];
  }
  elementConstructor = elementConstructor || createElement;
  if (elements.length > 0) {
    let builders = [];
    for (const element of elements) {
      builders.push(elementBuilderBuilder(elementConstructor, element));
    }
    return builders;
  }
  else {
    return new Proxy(() => { }, {
      apply(target, thisArg, args) {
        return elementBuildersBuilder(...args);
      },
      get(target, prop) {
        const result = target[prop];
        if (typeof result !== "undefined") {
          return result;
        }
        target[prop] = elementBuilderBuilder(elementConstructor, prop);
        return target[prop];
      }
    });
  }
}

const elementBuilders = elementBuildersBuilder();
export default elementBuilders;

