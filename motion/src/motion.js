import {DEFAULT_ANI_CONFIG} from './config';
import {is, flattenArray, toArray, select, getOriginValue, decomposeValue, setTargetValue, getAnimationType} from './util'; // eslint-disable-line
import tween from './tween';

import Events from './events';

class Motion {
	// set motionInstance by params
	constructor(target, properties, setting) {
        this.init(target, properties, setting);
        if(this.setting.autoPlay) this.play();
	}

    init(target, properties, setting) {
        this.targets = this.getTargets(target);
        this.properties = this.getproperties(properties);
        this.setting = Object.assign({}, DEFAULT_ANI_CONFIG, setting);
        this.animatables = this.getAnimatables(this.targets, this.properties, this.setting);
        this.totalDuration = this.setting.duration + this.setting.delay;

        this.initEvents(this.setting);

        this.time = 0; // 开始运动后的时间
        this.percent = 0; // 运动进程百分比
        this.running = false; // 是否正在运动
        this.ended = false; // 运动是否已经结束
        this.reversed = false; // 运动是否被反转过
        this.finished = new Promise(resolve => this.resolve = resolve); // 运动结束时被reslove的promise;

        this.progress = {}; // 记录运动声明周期中的各种参数
    }

    initEvents(setting) {
        this.event = new Events(); // 回调事件注册器
        ['begin', 'complete'].forEach(cb => setting[cb] && this.event.once(cb, setting[cb]));
        setting.update && this.event.on(`update`, setting.update);
    }

    // resolve targets from params
    getTargets(tarParam) {
    	let tar;
    	// selector
    	if(is.string(tarParam)) {
    		tar = toArray(select(tarParam));
    	// node
    	} else if(is.node(tarParam)) {
    		tar = [tarParam];
    	// nodeList
    	} else if(is.nodeList(tarParam)){
    		tar = toArray(tarParam);
    	} else {
    		throw new TypeError('the target type is not supported');
    	}
        return tar.map((target, id) => ({target, id}))
    }

    getproperties(p) {
        return Object.keys(p).map(key => ({name: key, value: p[key]}));
    }

    getAnimatables(targets, properties, setting) {
        let animatables = [];
        // 因为每个元素的起始属性位置不一样，因此需要每个元素都生成一个数组
        targets.forEach((tarObj) => {
            let {target} = tarObj;

            properties.forEach((prop) => {
                let obj = Object.assign({}, prop, setting);
                // TO_DO: 先只考虑普通css类型的运动
                obj.target = target;
                obj.id = tarObj.id;
                obj.type = getAnimationType(target, prop.name);
                obj.from = getOriginValue(target, prop.name, obj.type);
                obj.to = decomposeValue(prop, obj.type);

                animatables.push(obj);
            })
        })
        // return this.getTweens(animatables);
        return animatables;
    }

    // TO_DO: 应该运动过程相同的元素提出来，减少循环量，提高性能
    getTweens(animatables)　{} // eslint-disable-line



    /**
     * 根据当前的时间比例，起始值和终点值算出当前值
     * @param  {[type]} anim [description]
     * @param  {[type]} currentTime [description]
     * @return {[type]}      [description]
     */
    getCurrentValue(anim, currentTime) {
        const {setting} = this;
        // the actually running time of target
        let runningTime = Math.max(currentTime - anim.delay, 0); // eslint-disable-line
        // make sure that the runningTime is less than the duration
        let passed = Math.min(runningTime, setting.duration);
        let percent = passed / setting.duration;

        let eased = tween[setting.easing](percent, setting.elasticity);

        let start = anim.from.number;
        let end = anim.to.number;
        let currentValue = start + eased * (end - start); // eslint-disable-line
        currentValue = setting.round ? Math.round(currentValue) : currentValue;
        return currentValue;
    }

    setAnimationProgress(currentTime) {

        this.time = Math.min(currentTime, this.totalDuration); // the running time can not be more than the totalDuration time
        this.percent = (this.time / this.totalDuration) * 100; // eslint-disable-line

        let transforms = undefined; // object fot composing transform property of the same target
        this.animatables.forEach(anim => {
            anim.currentValue = this.getCurrentValue(anim, currentTime);
            let {currentValue, id} = anim;
            // setTargetValue(anim, currentValue);
            switch(anim.type) {
                case 'css': anim.target.style[anim.name] = `${anim.from.unit[0]}${currentValue}${anim.from.unit[1]}`; break;
                // case 'attribute': anim.target.style[anim.name] = currentValue; break;
                case 'transform':
                    if(!transforms) transforms = {};
                    if(!transforms[id]) transforms[id] = [];

                    transforms[id].push(`${anim.from.unit[0]}${currentValue}${anim.from.unit[1]}`);
                    break;
            }
        });

        // transform can only be setted once,
        // so wo must join all the property and then set the transform style once .
        if(transforms) Object.keys(transforms).forEach(id => {
        	var anim = this.animatables.filter(anima => anima.id === +id)[0];
        	anim && (anim.target.style.transform = `${transforms[id].join(' ')}`);
        });

        if (this.setting.update)  this.event.emit('update');
    }

    // 启动动画声明周期
	play() {
        const zero = 0, {setting: s} = this;
        this.pause();
        this.running = true;

        this.progress.start = Date.now();
        // 用于保存暂停后重新启动的时候，暂停之前运动持续的时间
        this.progress.last = this.ended ? zero : this.time;

        if(s.direction === 'reverse') this.reverseAnimation();
        if(s.direction === 'alternate' && !s.loop) s.loop = 1;

        let tick = this.tick.bind(this);
		this.raf = window.requestAnimationFrame(tick);
	}

    // 动画生命周期
    tick() {
        const {setting: s, progress} = this;
        if(!this.running) return;

        this.ended = false;
        progress.now = Date.now();
        progress.current = progress.last + progress.now - progress.start;

        if(progress.current >= s.delay ) {
            // s.begin(this);
            // s.begin = null;
            this.event.emit('begin');
        }

        // 真正对元素进行设置值，让元素产生动画
        this.setAnimationProgress(progress.current);


        // 如果动画持续时间已经大于过渡时间，则停止动画
        if(progress.current >= this.totalDuration) {
            if(s.loop) {
                progress.start = Date.now();
                if(s.direction === 'alternate') this.reverseAnimation();
                if(is.number(s.loop)) s.loop--;
                this.raf = window.requestAnimationFrame(() => this.tick());
            } else {
                this.pause();

                this.ended = true;
                this.resolve();
                s.complete && this.event.emit('complete');
            }
            progress.last = 0; // 将持续时间重置为0
        } else { // 继续执行动画
            this.raf = window.requestAnimationFrame(() => this.tick());
        }
    }

    reverseAnimation() {
        this.animatables.forEach(obj => {
            let [from, to] = [obj.to.number, obj.from.number];
            obj.from.number = from;
            obj.to.number = to;
        })
        this.reversed = !this.reversed;
    }

    pause() {
        this.running = false; // 暂停不代表结束
        this.raf && window.cancelAnimationFrame(this.raf);  // eslint-disable-line
    }

    restart() {
        if(this.reversed) this.reverseAnimation();
        this.pause();
        this.seek(0);
        this.play();
    }

    // TO_FIX: 不能够平缓的在当前位置立即反向.
    reverse () {
        this.reverseAnimation();
    }

    // TO_FIX: 不起作用
    seek(progress){
        var time = (progress / 100) * this.totalDuration;
        this.progress.current = time;
        this.setAnimationProgress(time);
    }
}

/**
 * main export
 * @param  {[type]} target     [description]
 * @param  {[type]} properties [description]
 * @param  {Object} setting    [description]
 * @return {[type]}            [description]
 */
function motion(target, properties, setting = {}) {
    return new Motion(target, properties, setting);
}

// frequently-used methods
motion.fadeIn = function(target) {
    return new Motion(target, {
        opacity: 1,
    }, {
        duration: 1500,
        easing: 'linear',
    });
}

motion.fadeOut = function(target) {
    return new Motion(target, {
        opacity: 0,
    }, {
        duration: 1500,
        easing: 'linear',
    });
}

module.exports = motion;

