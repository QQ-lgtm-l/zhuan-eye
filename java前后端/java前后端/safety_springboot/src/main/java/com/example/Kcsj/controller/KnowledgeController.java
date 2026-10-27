package com.example.Kcsj.controller;

import com.example.Kcsj.common.Result;
import com.example.Kcsj.service.SafetyKnowledgeService;
import org.springframework.web.bind.annotation.*;

import javax.annotation.Resource;

/**
 * 房建安全知识手册接口（分类浏览 / 搜索 / 详情）。
 */
@RestController
@RequestMapping("/knowledge")
public class KnowledgeController {

    @Resource
    private SafetyKnowledgeService knowledgeService;

    @GetMapping("/stats")
    public Result<?> stats() {
        return Result.success(knowledgeService.stats());
    }

    @GetMapping("/categories")
    public Result<?> categories() {
        return Result.success(knowledgeService.listCategories());
    }

    @GetMapping("/items")
    public Result<?> items(@RequestParam(required = false) String category,
                           @RequestParam(required = false) String keyword) {
        return Result.success(knowledgeService.listItems(category, keyword));
    }

    @GetMapping("/item/{id}")
    public Result<?> detail(@PathVariable String id) {
        if (knowledgeService.detail(id) == null) {
            return Result.error("-1", "知识条目不存在");
        }
        return Result.success(knowledgeService.detail(id));
    }
}
