<template>
  <v-card outlined style="display: flex; flex-direction:column" width="100%" height="100%" elevation=5>
    <Toolbar :title="'Kategorie ' + category.name + ' bearbeiten'" back >
      <template #right>
        <ToolbarButton
          icon="save"
          tooltip="Speichern"
          color="success"
          :loading="loading"
          @click="save"
          :disabled="!valid"
        />
      </template>
    </Toolbar>
    <v-divider />
    <v-card-text style="height: 100%; overflow: hidden;">
      <CategoryForm
        v-if="loaded"
        :category="category"
        @valid="onValid"
        action="create"
        showGroups
      />
    </v-card-text>
  </v-card>
</template>

<script>
import axios from 'axios'
import router from '@/router'
import CategoryForm from '@/components/category/CategoryForm'
import Toolbar from '@/components/layout/Toolbar'
import ToolbarButton from '@/components/layout/ToolbarButton'

export default {
  components: { CategoryForm, Toolbar, ToolbarButton },
  data() {
    return {
      category: {},
      valid: false,
      loaded: false,
      loading: false
    }
  },
  methods: {
    onValid (valid) {
      this.valid = valid;
    },
    save: function () {
      this.loading = true;
      var post = {...this.category};
      post.groups = post.groupsPopulated.map(g => g.cn);
      post.color = post.color.substr(1)
      post.text_color = post.text_color.substr(1)
      axios.post('/api/category/update', post)
        .then(response => {
          this.$snackbar.success(response.data.message)
          this.loading = false;
          router.push('/category/list')
        })
        .catch(error => {this.loading=false;})
    },
    getData: function () {
      return axios.get('/api/category/' + this.$route.query.id)
        .then(response => {
          response.data.category.color = '#' + response.data.category.color;
          response.data.category.text_color = '#' + response.data.category.text_color;
          this.category = response.data.category;
          this.loaded = true;
        })
        .catch(e => {})
    }
  },
  created() {
    this.getData();
  }
}
</script>