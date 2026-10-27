package com.example.Kcsj.mapper;

import com.example.Kcsj.entity.Message;
import com.baomidou.mybatisplus.core.mapper.BaseMapper;
import org.apache.ibatis.annotations.Mapper;
import org.apache.ibatis.annotations.Select;
import org.apache.ibatis.annotations.Update;

import java.util.List;

@Mapper
public interface MessageMapper extends BaseMapper<Message> {

    @Select("SELECT * FROM message WHERE user_id = #{userId} AND is_deleted = 0 ORDER BY create_time DESC")
    List<Message> findByUserId(String userId);

    @Select("SELECT COUNT(*) FROM message WHERE user_id = #{userId} AND is_read = 0 AND is_deleted = 0")
    Integer countUnread(String userId);

    @Update("UPDATE message SET is_read = 1 WHERE id = #{id}")
    void markRead(Integer id);

    @Update("UPDATE message SET is_read = 1 WHERE user_id = #{userId} AND is_deleted = 0")
    void markAllRead(String userId);

    @Update("UPDATE message SET is_deleted = 1 WHERE id = #{id}")
    void softDelete(Integer id);

    @Update("UPDATE message SET is_deleted = 1 WHERE user_id = #{userId}")
    void softDeleteAll(String userId);
}