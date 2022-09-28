<template>
  <ag-grid-vue
    :localeText="aggridLocale.locale_de"
    :style="tableStyle"
    class="ag-theme-material"
    :defaultColDef="defaultColDef"
    :columnDefs="columnDefs"
    :rowData="rowData"
    @grid-ready="onGridReady"
    @first-data-rendered="onFirstDataRendered"
    @row-selected="onRowSelected"
    @selection-changed="selected => $emit('selectionChanged', gridApi.getSelectedRows())"
    :pagination="true"
    paginationPageSize="25"
    row-selection="single"
  />
</template>

<script>
import axios from 'axios'
import moment from 'moment'
import router from '../../router'
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-material.css";
import aggridLocale from '@/assets/ag-grid.locale.js';
import { AgGridVue } from "ag-grid-vue";
import ChipCell from '@/components/table/ChipCell';
export default {
  name: 'AppTable',
  components: {
    AgGridVue, ChipCell
  },
  props: {
    apps: Array,
    search: String,
    heightOffset: Number
  },
  data () {
    return {
      tableStyle: '',
      defaultColDef: [],
      columnDefs: [],
      rowData: [],
      aggridLocale: aggridLocale,
      gridApi: null,
      columnApi: null
    }
  },
  watch: {
    search(newSearch, oldSearch) {
      this.gridApi.onFilterChanged();
    }
  },
  methods: {
    onGridReady(params) {
        this.gridApi = params.api;
        this.columnApi = params.columnApi;
        this.$emit('onGridReady', params);
    },
    onFirstDataRendered(params) {
      this.columnApi.autoSizeAllColumns()
    },
    onRowSelected(event) {
      this.$emit('selectApp', event.node.data, event.node.isSelected());
    }
  },
  created() {
    this.tableStyle = "width: 100%; height: calc(100% - " + (this.heightOffset || 0) +"px)"
    this.rowData = this.apps.map(app => {
      app.groups = app.groups.map(group => { return {dn: group, cn: group.split(',')[0].split('=')[1]}});
      return app;
    });
    var selectorCellDef;
    selectorCellDef = { checkboxSelection: true, maxWidth: 50};

    var textStyle = { 'line-height': 'normal', 'padding-top': '14px', 'padding-bottom': '14px'}

    this.columnDefs = [
      selectorCellDef,
      { headerName: "ID", field: "id", cellStyle: textStyle},
      { headerName: "Name", field: "label", cellStyle: textStyle},
      { headerName: "URL", field: "url",  cellStyle: textStyle},
      { headerName: "SSO", field: "saml.samlEnabled",  cellStyle: textStyle, valueGetter: params => { return params.data.saml.samlEnabled?'Ja':'Nein'}}
    ];
    this.columnDefs.push({ headerName: "Gruppen", field: "groups", cellStyle: {'white-space': 'normal'}, maxWidth: 300, autoHeight: true, cellRenderer: 'ChipCell', cellRendererParams: { color: 'info', field: 'cn', tooltip: 'group', emptyValue: 'Alle'}
      })
    this.defaultColDef = {
      resizable: true,
      wrapText: true,
      autoHeight: true,
      cellStyle: { 'word-break': 'normal'}
    };
  },
}
</script>
