
var pmDashboard = {
    pageSize:20,
    model:{
        name:"module"
    }
}

pmDashboard.model.className = "pmDashboard"

pmDashboard.model.count = {
    projects:'-',
    inventories:'-',
    hosts:'-',
    groups:'-',
    users:'-',
    history:'-',
}

pmDashboard.statsData={
    projects:'-',
    inventories:'-',
    hosts:'-',
    groups:'-',
    users:'-',
    templates:'-'
}

pmDashboard.statsDataLast=14;
pmDashboard.statsDataLastQuery=14;
pmDashboard.statsDataMomentType='day';

if(window.localStorage['selected-chart-period'] && window.localStorage['selected-chart-period-query'] &&  window.localStorage['selected-chart-period-type'])
{
    pmDashboard.statsDataLast=window.localStorage['selected-chart-period'];
    pmDashboard.statsDataLastQuery=window.localStorage['selected-chart-period-query'];
    pmDashboard.statsDataMomentType=window.localStorage['selected-chart-period-type'];
}

/**
 * Двумерный массив с описанием списка отображаемых виджетов в каждой строке
 *
 * @example
 * [
 *  [{
        name:'pmwTemplatesCounter',  // Имя класса виджета
        opt:{},                      // Опции для виджета
    }]
 ]
 *
 * @type Array
 */
pmDashboard.model.widgets = [
    [
        {
            name:'pmwTemplatesCounter',
            opt:{},
        },
        {
            name:'pmwProjectsCounter',
            opt:{},
        },
        {
            name:'pmwInventoriesCounter',
            opt:{},
        },
        {
            name:'pmwHostsCounter',
            opt:{},
        },
        {
            name:'pmwGroupsCounter',
            opt:{},
        },
        {
            name:'pmwUsersCounter',
            opt:{},
        }, /**/
    ],
]

pmDashboard.stopUpdates = function()
{
    clearTimeout(this.model.updateTimeoutId)
    this.model.updateTimeoutId = undefined;
}

tabSignal.connect('pmLocalSettings.hideMenu', function(){

    setTimeout(function(){

        if(spajs.currentOpenMenu && spajs.currentOpenMenu.id == 'home')
        {
            pmDashboard.updateData()
        }
    }, 200)
})

pmDashboard.updateData = function()
{
    var thisObj = this
    if(this.model.updateTimeoutId)
    {
        clearTimeout(this.model.updateTimeoutId)
        this.model.updateTimeoutId = undefined
    }

    $.when(pmDashboard.loadStats()).done(function()
    {
        //обновляем счетчики для виджетов
        pmwHostsCounter.updateCount();
        pmwTemplatesCounter.updateCount();
        pmwGroupsCounter.updateCount();
        pmwProjectsCounter.updateCount();
        pmwInventoriesCounter.updateCount();
        pmwUsersCounter.updateCount();

        //строим график
        //задаем стартовую дату для графика.
        //pmDashboard.statsDataLast - количество периодов назад
        //pmDashboard.statsDataMomentType - тип периода - месяц/год
        if(pmDashboard.statsDataMomentType=="year" || pmDashboard.statsDataMomentType=="month")
        {
            //определяем текущий месяц и год
            var monthNum=moment().format("MM");
            var yearNum=moment().format("YYYY");
            if(pmDashboard.statsDataMomentType=="year")
            {
                var startTimeOrg=yearNum+"-01-01";
            }
            else
            {
                var startTimeOrg=yearNum+"-"+monthNum+"-01";
            }
            var startTime = moment(startTimeOrg).subtract(pmDashboard.statsDataLast-1, pmDashboard.statsDataMomentType).format("YYYY-MM-DD")+"T00:00:00.000000Z";
        }
        else
        {
            var startTime = moment().subtract(pmDashboard.statsDataLast-1, pmDashboard.statsDataMomentType).format("YYYY-MM-DD")+"T00:00:00.000000Z";
        }

        tasks_data = {};
        tasks_data_t = [];

        var time = new Date(startTime)
        time = Math.floor(time.getTime()/(1000*3600*24))*3600*1000*24;

        //формируем в цикле временные отрезки для графика относительно стартовой даты
        for(var i = 1; i<= pmDashboard.statsDataLast+1; i++)
        {
            tasks_data[time] = 0;
            tasks_data_t.push(time);

            //идем на период вперед
            var newTime=moment(startTime).add(i, pmDashboard.statsDataMomentType).format("YYYY-MM-DD")+"T00:00:00.000000Z";
            time = new Date(newTime);
            time=Math.floor(time.getTime()/(1000*3600*24))*3600*1000*24;
        }


        //формируем массив значений для кривой all tasks
        for(var i in pmDashboard.statsData.jobs[pmDashboard.statsDataMomentType])
        {
            var val = pmDashboard.statsData.jobs[pmDashboard.statsDataMomentType][i];
            var time = new Date(val[pmDashboard.statsDataMomentType])
            time = Math.floor(time.getTime()/(1000*3600*24))*3600*1000*24;

            if(!tasks_data[time])
            {
                tasks_data[time] = val.all;
                tasks_data_t.push(time)
            }
        }
        chart_tasks_start_x = ['time'];
        chart_tasks_data = ['All tasks'];
        for(var j in tasks_data_t)
        {
            var time = tasks_data_t[j]
            chart_tasks_start_x.push(time/1);
            chart_tasks_data.push(tasks_data[time]/1);
        }

        //формируем массив значений для кривой каждого статуса
        chart_tasks_data_OK=pmDashboard.getDataForStatusChart(tasks_data, tasks_data_t, "OK");
        chart_tasks_data_ERROR=pmDashboard.getDataForStatusChart(tasks_data, tasks_data_t, "ERROR");
        chart_tasks_data_INTERRUPTED=pmDashboard.getDataForStatusChart(tasks_data, tasks_data_t, "INTERRUPTED");
        chart_tasks_data_DELAY=pmDashboard.getDataForStatusChart(tasks_data, tasks_data_t, "DELAY");
        chart_tasks_data_OFFLINE=pmDashboard.getDataForStatusChart(tasks_data, tasks_data_t, "OFFLINE");

        //загружаем график, перечисляем массивы данных для графика
        pmDashboard.model.historyChart.load({
            columns: [
                chart_tasks_start_x,chart_tasks_data,

                chart_tasks_data_OK, chart_tasks_data_ERROR,
                chart_tasks_data_INTERRUPTED, chart_tasks_data_DELAY,
                chart_tasks_data_OFFLINE
            ]
        });
    });

    this.model.updateTimeoutId = setTimeout(function(){
        pmDashboard.updateData()
    }, 1000*30)
}

/**
 * Функция, которая формирует массив данных для кривых графика по отдельному статусу
 */
pmDashboard.getDataForStatusChart = function(tasks_data, tasks_data_t, status)
{
    for(var i in tasks_data) {
        tasks_data[i]=0;
    }


    for(var i in pmDashboard.statsData.jobs[pmDashboard.statsDataMomentType])
    {
        var val = pmDashboard.statsData.jobs[pmDashboard.statsDataMomentType][i];
        var time = new Date(val[pmDashboard.statsDataMomentType])
        time = Math.floor(time.getTime()/(1000*3600*24))*3600*1000*24;

        if(val.status==status){
            tasks_data[time] = val.sum;
            tasks_data_t.push(time)
        }
    }

    var chart_tasks_data1 = [status];

    for(var j in tasks_data_t)
    {
        var time = tasks_data_t[j]
        chart_tasks_data1.push(tasks_data[time]/1);
    }
    return chart_tasks_data1;

}


pmDashboard.open  = function(holder, menuInfo, data)
{

    var thisObj = this

    // Инициализация всех виджетов на странице
    for(var i in pmDashboard.model.widgets)
    {
        for(var j in pmDashboard.model.widgets[i])
        {
            if(pmDashboard.model.widgets[i][j].widget === undefined)
            {
                pmDashboard.model.widgets[i][j].widget = new window[pmDashboard.model.widgets[i][j]['name']](pmDashboard.model.widgets[i][j].opt);
            }
        }
    }

    this.updateData()
    $(holder).insertTpl(spajs.just.render('dashboard_page', {}))

    pmTasksTemplates.showTaskWidget($("#pmTasksTemplates-showTaskWidget"));
    pmTasksTemplates.showModuleWidget($("#pmTasksTemplates-showModuleWidget"));
    pmAnsibleModule.fastCommandWidget($("#pmAnsibleModule-fastCommandWidget"))

    pmDashboard.model.historyChart = c3.generate({
        bindto: '#c3-history-chart',
        data: {
            x: 'time',
            columns: [
                ['time'],
                ['All tasks'],
                ['OK'],
                ['ERROR'],
                ['INTERRUPTED'],
                ['DELAY'],
                ['OFFLINE']
            ],
            type: 'area',
            types: {
                OK: 'line',
                ERROR: 'line',
                INTERRUPTED: 'line',
                DELAY: 'line',
                OFFLINE: 'line'
            },
        },
        axis: {
            x: {
                type: 'timeseries',
                tick: {
                    format: '%Y-%m-%d'
                }
            }
        },
        color: {
            pattern: ['#1f77b4',  '#276900', '#333333', '#9b97e4', '#808419', '#9e9e9e', '#d62728',  '#9467bd', '#c5b0d5', '#8c564b', '#c49c94', '#e377c2', '#f7b6d2', '#7f7f7f', '#c7c7c7', '#bcbd22', '#dbdb8d', '#17becf', '#9edae5']
        }
    });
    if($('select').is('#chart-period'))
    {
        $('#chart-period').val(pmDashboard.statsDataLastQuery).change();
    }
}

tabSignal.connect("polemarch.start", function()
{
    spajs.addMenu({
        id:"home",
        urlregexp:[/^(home|)$/],
        onOpen:function(holder, menuInfo, data){return pmDashboard.open(holder, menuInfo, data);},
        onClose:function(){return pmDashboard.stopUpdates();},
    })

})


/**
 * Функция, отправляющая запрос /api/v1/stats/,
 * который дает нам информацию для виджетов класса pmwItemsCounter,
 * а также для графика на странице Dashboard.
 */
pmDashboard.loadStats=function()
{
    var limit=1;
    var thisObj = this;
    return spajs.ajax.Call({
        url: "/api/v1/stats/?last="+pmDashboard.statsDataLastQuery,
        type: "GET",
        contentType: 'application/json',
        data: "limit=" + encodeURIComponent(limit)+"&rand="+Math.random(),
        success: function (data)
        {
            pmDashboard.statsData=data;
        },
        error: function (e)
        {
            console.warn(e)
            polemarch.showErrors(e)
        }
    });
}

/**
 *Функция вызывается, когда происходит изменение периода на графике(пользователь выбрал другой option в select).
 *Функция обновляет значения переменных, которые в дальнейшем используются для запроса к api/v1/stats и отрисовки графика.
 */

pmDashboard.updateStatsDataLast=function(thisEl)
{
    var newLast=thisEl.value;
    switch(newLast) {
        case '1095':
            pmDashboard.statsDataLast=3;
            pmDashboard.statsDataMomentType="year";
            window.localStorage['selected-chart-period']=3;
            window.localStorage['selected-chart-period-type']="year";
            break;
        case '365':
            pmDashboard.statsDataLast=13;
            pmDashboard.statsDataMomentType="month";
            window.localStorage['selected-chart-period']=13;
            window.localStorage['selected-chart-period-type']="month";
            break;
        case '99':
            pmDashboard.statsDataLast=3;
            pmDashboard.statsDataMomentType="month";
            window.localStorage['selected-chart-period']=3;
            window.localStorage['selected-chart-period-type']="month";
            break;
        default:
            pmDashboard.statsDataLast=+newLast;
            pmDashboard.statsDataMomentType="day";
            window.localStorage['selected-chart-period']=+newLast;
            window.localStorage['selected-chart-period-type']="day";
            break;
    }
    pmDashboard.statsDataLastQuery=+newLast;
    window.localStorage['selected-chart-period-query']=+newLast;
    pmDashboard.updateData();
}


/**
 * Базовый класс виджета
 * @type Object
 */
pmDashboardWidget = {
    id:'',
    model:{
        test:1
    },
    render:function(){

    },
    init:function(opt){
        mergeDeep(this.model, opt)
    }
}

/**
 * Базовый класс виджета показывающего количество элементов
 * @type Object
 */
var pmwItemsCounter = inheritance(pmDashboardWidget);

pmwItemsCounter.model.count = '-';
pmwItemsCounter.model.countObject = pmItems;
pmwItemsCounter.model.nameInStats = "";

pmwItemsCounter.render = function()
{

    var thisObj = this;
    var html = spajs.just.render('pmwItemsCounter', {model:this.model});
    return window.JUST.onInsert(html, function(){});
}
pmwItemsCounter.updateCount = function()
{
    var thisObj = this;
    var statsData=pmDashboard.statsData;
    thisObj.model.count=statsData[thisObj.model.nameInStats];
}

/**
 * Класс виджета показывающий количество хостов
 * @type Object
 */
var pmwHostsCounter = inheritance(pmwItemsCounter);
pmwHostsCounter.model.countObject = pmHosts;
pmwHostsCounter.model.nameInStats = "hosts";

/**
 * Класс виджета показывающий количество шаблонов
 * @type Object
 */
var pmwTemplatesCounter = inheritance(pmwItemsCounter);
pmwTemplatesCounter.model.countObject = pmTemplates;
pmwTemplatesCounter.model.nameInStats = "templates";

/**
 * Класс виджета показывающий количество групп
 * @type Object
 */
var pmwGroupsCounter = inheritance(pmwItemsCounter);
pmwGroupsCounter.model.countObject = pmGroups;
pmwGroupsCounter.model.nameInStats = "groups";

/**
 * Класс виджета показывающий количество проектов
 * @type Object
 */
var pmwProjectsCounter = inheritance(pmwItemsCounter);
pmwProjectsCounter.model.countObject = pmProjects;
pmwProjectsCounter.model.nameInStats = "projects";

/**
 * Класс виджета показывающий количество инвенториев
 * @type Object
 */
var pmwInventoriesCounter = inheritance(pmwItemsCounter);
pmwInventoriesCounter.model.countObject = pmInventories;
pmwInventoriesCounter.model.nameInStats = "inventories";

/**
 * Класс виджета показывающий количество пользователей
 * @type Object
 */
var pmwUsersCounter = inheritance(pmwItemsCounter);
pmwUsersCounter.model.countObject = pmUsers;
pmwUsersCounter.model.nameInStats = "users";
